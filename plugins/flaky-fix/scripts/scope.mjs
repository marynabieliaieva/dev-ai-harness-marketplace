#!/usr/bin/env node
// Step 2: turns the stack trace and the test file into the "suspect scope" —
// the tracked files a culprit commit could have touched — and the list of
// files the fix may edit without asking.
//
// Usage: node scope.mjs [--id <run>]
// Writes frames.json and scope.json; prints a short summary.

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { advance, fail, gitLines, normalize, parseArgs, readJson, requireRun, writeJson } from './lib/run.mjs';

const args = parseArgs();
const { id, dir, state } = requireRun(args);
if (state.stage !== 'intake' && state.stage !== 'scoped') fail(`run is at "${state.stage}"; scope runs right after intake`);

const input = readJson(path.join(dir, 'input.json'));
const stack = readFileSync(path.join(dir, 'stacktrace.txt'), 'utf8');
const tracked = gitLines(['ls-files']);
const trackedSet = new Set(tracked);

const VENDOR_RE = /(^|\/)(node_modules|site-packages|dist-packages|vendor|third_party|\.venv|venv)\//;
const PLATFORM_FQN_RE = /^(java|javax|jdk|sun|com\.sun|kotlin|kotlinx|scala|org\.junit|junit|org\.testng|org\.mockito|org\.springframework|org\.gradle|org\.apache\.maven)\./;

// ---- frames ---------------------------------------------------------------

const FRAME_PATTERNS = [
  // JVM: at com.acme.OrderService.create(OrderService.java:42)
  { kind: 'jvm', re: /at\s+([\w$.]+)\.[\w$<>-]+\(([\w$-]+\.(?:java|kt|scala|groovy)):(\d+)\)/g, map: (m) => ({ fqn: m[1], file: m[2], line: +m[3] }) },
  // Python: File "app/orders.py", line 42, in create
  { kind: 'python', re: /File "([^"]+)", line (\d+)/g, map: (m) => ({ file: m[1], line: +m[2] }) },
  // C#: in C:\src\Orders\Service.cs:line 42
  { kind: 'dotnet', re: /\bin\s+(.+?\.cs):line\s+(\d+)/g, map: (m) => ({ file: m[1], line: +m[2] }) },
  // JS/TS: at fn (src/orders.ts:42:7) or at src/orders.ts:42:7
  { kind: 'js', re: /at\s+(?:.*?\()?((?:file:\/\/)?(?:[A-Za-z]:)?[^\s():]+\.[cm]?[jt]sx?):(\d+)(?::\d+)?\)?/g, map: (m) => ({ file: m[1].replace(/^file:\/\//, ''), line: +m[2] }) },
  // Go / Ruby / generic "path.ext:line"
  { kind: 'generic', re: /((?:[A-Za-z]:)?[\w./\\-]+\.(?:go|rb|php|rs|swift|py|java|kt|ts|tsx|js|jsx|mjs|cs)):(\d+)/g, map: (m) => ({ file: m[1], line: +m[2] }) },
];

const frames = [];
const unmatched = [];
const seen = new Set();
for (const { kind, re, map } of FRAME_PATTERNS) {
  for (const m of stack.matchAll(re)) {
    const f = map(m);
    const key = `${f.file}:${f.line}`;
    if (seen.has(key)) continue;
    seen.add(key);
    if (f.fqn && PLATFORM_FQN_RE.test(f.fqn)) continue;
    const file = resolveFrame(f);
    if (file) frames.push({ kind, raw: m[0].trim(), file, line: f.line });
    else if (!VENDOR_RE.test(normalize(f.file) ?? '')) unmatched.push(m[0].trim());
  }
}

function resolveFrame({ file, fqn }) {
  const norm = normalize(file);
  if (!norm || VENDOR_RE.test(norm)) return null;
  // JVM frames name the file without its directory; the class name gives it.
  if (fqn) {
    const outer = fqn.replace(/\$.*$/, '');
    const pkgPath = `${outer.split('.').slice(0, -1).join('/')}/${path.posix.basename(norm)}`;
    const byPkg = tracked.filter((t) => t.endsWith(`/${pkgPath}`) || t === pkgPath);
    if (byPkg.length) return byPkg[0];
  }
  return longestSuffixMatch(norm);
}

function longestSuffixMatch(norm) {
  const parts = norm.split('/').filter((s) => s && s !== '.' && !/^[a-z]:$/.test(s));
  for (let i = 0; i < parts.length; i++) {
    const suffix = parts.slice(i).join('/');
    const hits = tracked.filter((t) => t === suffix || t.endsWith(`/${suffix}`));
    if (hits.length === 1) return hits[0];
    if (hits.length > 1 && i === parts.length - 1) return null; // bare basename, ambiguous
  }
  return null;
}

// ---- direct imports ---------------------------------------------------------

const JS_EXT = ['', '.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '/index.ts', '/index.tsx', '/index.js', '/index.mjs'];

function importsOf(file) {
  let text;
  try {
    text = readFileSync(path.join(process.env.CLAUDE_PROJECT_DIR || process.cwd(), file), 'utf8');
  } catch {
    return [];
  }
  const out = new Set();
  const base = path.posix.dirname(file);
  if (/\.[cm]?[jt]sx?$/.test(file)) {
    for (const m of text.matchAll(/(?:from\s+|require\(\s*|import\(\s*)['"](\.{1,2}\/[^'"]+)['"]/g)) {
      const target = path.posix.normalize(path.posix.join(base, m[1]));
      const hit = JS_EXT.map((e) => target + e).find((c) => trackedSet.has(c));
      if (hit) out.add(hit);
    }
  } else if (file.endsWith('.py')) {
    for (const m of text.matchAll(/^\s*(?:from\s+(\.*[\w.]*)\s+import|import\s+([\w.]+))/gm)) {
      const mod = m[1] ?? m[2];
      const dots = mod.match(/^\.*/)[0].length;
      const rest = mod.slice(dots).replace(/\./g, '/');
      const candidates = [];
      if (dots) {
        let d = base;
        for (let i = 1; i < dots; i++) d = path.posix.dirname(d);
        candidates.push(path.posix.join(d, `${rest}.py`), path.posix.join(d, rest, '__init__.py'));
      } else if (rest) {
        candidates.push(`${rest}.py`, `${rest}/__init__.py`);
      }
      for (const c of candidates) {
        const hit = tracked.find((t) => t === c || t.endsWith(`/${c}`));
        if (hit) {
          out.add(hit);
          break;
        }
      }
    }
  } else if (/\.(java|kt|scala|groovy)$/.test(file)) {
    for (const m of text.matchAll(/^\s*import\s+(?:static\s+)?([\w.]+)\s*;?/gm)) {
      if (PLATFORM_FQN_RE.test(`${m[1]}.`)) continue;
      const parts = m[1].split('.');
      // static imports end in a member; try the class path with and without it
      for (const cut of [parts.length, parts.length - 1]) {
        const p = parts.slice(0, cut).join('/');
        const hit = tracked.find((t) => /\.(java|kt|scala|groovy)$/.test(t) && t.replace(/\.\w+$/, '').endsWith(`/${p}`));
        if (hit) {
          out.add(hit);
          break;
        }
      }
    }
  }
  return [...out];
}

// ---- module context -----------------------------------------------------------

const testFile = input.testFile;
const ancestors = [];
for (let d = path.posix.dirname(testFile); ; d = path.posix.dirname(d)) {
  ancestors.push(d === '.' ? '' : d);
  if (d === '.' || d === '/' || d === '') break;
}
const inAncestor = (f) => ancestors.includes(path.posix.dirname(f) === '.' ? '' : path.posix.dirname(f));

const MANIFEST_RE = /(^|\/)(package\.json|package-lock\.json|pnpm-lock\.yaml|yarn\.lock|pom\.xml|build\.gradle(\.kts)?|settings\.gradle(\.kts)?|gradle\.lockfile|libs\.versions\.toml|requirements[\w.-]*\.txt|pyproject\.toml|poetry\.lock|Pipfile(\.lock)?|setup\.(cfg|py)|go\.(mod|sum)|Cargo\.(toml|lock)|[\w.-]+\.csproj|Directory\.(Packages|Build)\.props|Gemfile(\.lock)?|composer\.(json|lock))$/;
const TEST_CONFIG_RE = /(^|\/)(jest\.config\.[\w]+|vitest\.config\.[\w]+|\.mocharc[\w.]*|karma\.conf\.[\w]+|playwright\.config\.[\w]+|pytest\.ini|conftest\.py|tox\.ini|junit-platform\.properties|testng\.xml|\.runsettings|[\w.-]*\.runsettings)$/;
const CI_RE = /^(\.github\/workflows\/[^/]+\.ya?ml|\.gitlab-ci\.yml|Jenkinsfile|azure-pipelines\.yml|\.circleci\/config\.yml|bitbucket-pipelines\.yml|\.buildkite\/[^/]+)$/;

const frameFiles = [...new Set(frames.map((f) => f.file))];
const imports = [...new Set([testFile, ...frameFiles].flatMap(importsOf))].filter((f) => f !== testFile && !frameFiles.includes(f));
const manifests = tracked.filter((f) => MANIFEST_RE.test(f) && inAncestor(f));
const testConfig = tracked.filter((f) => TEST_CONFIG_RE.test(f) && inAncestor(f));
const ci = tracked.filter((f) => CI_RE.test(f));
const moduleTestDir = path.posix.dirname(testFile);

const paths = [...new Set([testFile, ...frameFiles, ...imports, ...manifests, ...testConfig, ...ci])];
const scope = {
  testFile,
  frameFiles,
  imports,
  manifests,
  testConfig,
  ci,
  moduleTestDir,
  paths,
  // The fix may edit these without a prompt; anything else asks the user.
  editable: [...new Set([testFile, ...frameFiles, ...imports])],
  editableDirs: [moduleTestDir],
};

writeJson(path.join(dir, 'frames.json'), { frames, unmatched });
writeJson(path.join(dir, 'scope.json'), scope);
advance(id, 'intake', 'scoped');

process.stdout.write(
  `${JSON.stringify(
    {
      frames: frames.length,
      unmatchedFrames: unmatched.length,
      frameFiles: frameFiles.length,
      imports: imports.length,
      manifests: manifests.length,
      testConfig: testConfig.length,
      ci: ci.length,
      warning: frames.length === 0 ? 'no stack frame maps to a tracked file — scope is the test file and its module only' : undefined,
    },
    null,
    2,
  )}\n`,
);
