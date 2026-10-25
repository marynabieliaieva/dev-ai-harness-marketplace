// Finds changes that make a flaky test pass without removing its cause:
// retries, skips, sleeps, bigger timeouts, swallowed errors, fewer
// assertions. A hit is not a verdict — fix-critic must answer every one of
// them (validate.mjs review enforces that).

import { git } from './run.mjs';

const ADDED_PATTERNS = [
  ['retry', /@(Retry|RetryingTest|RepeatedIfExceptionsTest|Flaky|FlakyTest)\b|pytest\.mark\.(flaky|rerun)|\breruns\s*=|jest\.retryTimes|this\.retries\(|\bretries\s*:|rerunFailingTestsCount|flakyTestRetries|\[Retry\(/],
  ['skip', /@(Ignore|Disabled)\b|\b(it|test|describe)\.(skip|todo)\(|\bx(it|describe|test)\(|pytest\.mark\.(skip|skipif|xfail)|unittest\.skip|\bt\.Skip\(|\[Ignore\]|\[Fact\(Skip|\[Theory\(Skip/],
  ['sleep', /Thread\.sleep|time\.sleep|\bsleep\(|\bsetTimeout\(|Task\.Delay|\bdelay\(\s*\d|waitForTimeout\(/],
  ['timeout', /time_?out\w*\s*[:=(]\s*\d|\d+\s*\)?\s*;?\s*\/\/.*timeout|--timeout[= ]\d|testTimeout|@Timeout\(/i],
  ['swallowed-error', /catch\s*(\([^)]*\))?\s*\{\s*\}|except[^:\n]*:\s*pass\b|\.catch\(\s*\(\)\s*=>\s*\{?\s*\}?\s*\)/],
];
const ASSERT_RE = /\b(assert\w*|expect|should|verify|require\.\w+|t\.(Error|Fatal)\w*)\b/;

/** Returns { base, hits: [{file, line, pattern, text}] } for base..HEAD. */
export function scanMasking(base) {
  const diff = git(['diff', '--unified=0', '--no-color', `${base}..HEAD`]);
  const hits = [];
  const asserts = new Map(); // file -> {added, removed}
  let file = null;
  let line = 0;
  for (const raw of diff.split(/\r?\n/)) {
    if (raw.startsWith('+++ ')) {
      file = raw.startsWith('+++ b/') ? raw.slice(6) : null;
      continue;
    }
    if (raw.startsWith('--- ')) continue;
    const hunk = raw.match(/^@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@/);
    if (hunk) {
      line = Number(hunk[1]);
      continue;
    }
    if (!file) continue;
    const count = asserts.get(file) ?? { added: 0, removed: 0 };
    if (raw.startsWith('+')) {
      const text = raw.slice(1);
      for (const [pattern, re] of ADDED_PATTERNS) {
        if (re.test(text)) hits.push({ file, line, pattern, text: text.trim().slice(0, 200) });
      }
      if (ASSERT_RE.test(text)) count.added++;
      line++;
    } else if (raw.startsWith('-')) {
      if (ASSERT_RE.test(raw.slice(1))) count.removed++;
    }
    asserts.set(file, count);
  }
  for (const [f, { added, removed }] of asserts) {
    if (removed > added) hits.push({ file: f, line: 0, pattern: 'fewer-assertions', text: `${removed} assertion lines removed, ${added} added` });
  }
  return { base, hits };
}
