/**
 * Filesystem anchors. The eval package reads the marketplace's real plugin artifacts —
 * plugins/<plugin>/skills/<skill>/SKILL.md and plugins/<plugin>/agents/<agent>.md — by relative
 * path. These helpers are the single source of those locations.
 *
 * Artifacts are addressed by their bare name (`onion-architecture`, `architecture-reviewer`) or
 * by their namespaced name (`engineering-paved-path:onion-architecture`). A bare name that exists
 * in two plugins is an error: pass the namespaced form.
 */

import { existsSync, readdirSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
export const EVALS_DIR = join(HERE, "..", "..");
export const REPO_ROOT = join(EVALS_DIR, "..");
export const PLUGINS_DIR = join(REPO_ROOT, "plugins");
export const RESULTS_DIR = join(EVALS_DIR, "results");

export interface Artifact {
  plugin: string;
  name: string;
  /** Skill: its directory. Agent: its .md file. */
  path: string;
}

function plugins(): string[] {
  if (!existsSync(PLUGINS_DIR)) return [];
  return readdirSync(PLUGINS_DIR)
    .filter((d) => statSync(join(PLUGINS_DIR, d)).isDirectory())
    .sort();
}

export function listSkills(): Artifact[] {
  return plugins().flatMap((plugin) => {
    const dir = join(PLUGINS_DIR, plugin, "skills");
    if (!existsSync(dir)) return [];
    return readdirSync(dir)
      .filter((d) => existsSync(join(dir, d, "SKILL.md")))
      .sort()
      .map((name) => ({ plugin, name, path: join(dir, name) }));
  });
}

export function listAgents(): Artifact[] {
  return plugins().flatMap((plugin) => {
    const dir = join(PLUGINS_DIR, plugin, "agents");
    if (!existsSync(dir)) return [];
    return readdirSync(dir)
      .filter((f) => f.endsWith(".md") && f !== "README.md")
      .sort()
      .map((f) => ({ plugin, name: f.replace(/\.md$/, ""), path: join(dir, f) }));
  });
}

function resolve(kind: "skill" | "agent", ref: string, all: Artifact[]): Artifact {
  const [plugin, name] = ref.includes(":") ? ref.split(":", 2) : [undefined, ref];
  const hits = all.filter((a) => a.name === name && (!plugin || a.plugin === plugin));
  if (hits.length === 1) return hits[0];
  if (hits.length === 0) throw new Error(`${kind} not found in plugins/: ${ref}`);
  throw new Error(`${kind} "${ref}" exists in ${hits.map((h) => h.plugin).join(", ")} — use <plugin>:${name}`);
}

export const skillDir = (ref: string) => resolve("skill", ref, listSkills()).path;
export const agentFile = (ref: string) => resolve("agent", ref, listAgents()).path;

/** Every plugin directory — what workflowTask loads into the session. */
export const pluginDirs = () => plugins().map((p) => join(PLUGINS_DIR, p));
