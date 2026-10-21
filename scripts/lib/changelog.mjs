// CHANGELOG.md helpers for the release scripts (Keep a Changelog layout:
// "## [Unreleased]", then "## [1.2.0] - 2026-10-21" entries, newest first).

const escape = (version) => version.replace(/[.+]/g, '\\$&');

/** Same heading rule as scripts/release.mjs: "## 1.2.0", "## [1.2.0] - date", "### v1.2.0". */
export function hasVersionEntry(text, version) {
  return new RegExp(`^#{1,3}\\s*\\[?v?${escape(version)}\\]?(\\s|$)`, 'm').test(text);
}

/** Inserts a released entry after "## [Unreleased]", or above the newest entry when there is none. */
export function addEntry(text, version, date, body) {
  const entry = `## [${version}] - ${date}\n\n${body.trim()}\n\n`;
  const lines = text.split(/\r?\n/);
  const unreleased = lines.findIndex((l) => /^##\s*\[?unreleased\]?/i.test(l));
  const from = unreleased === -1 ? 0 : unreleased + 1;
  const next = lines.findIndex((l, i) => i >= from && /^##\s/.test(l));
  const at = next === -1 ? lines.length : next;
  return [...lines.slice(0, at), ...entry.split('\n'), ...lines.slice(at)].join('\n').replace(/\n{3,}/g, '\n\n').trimEnd() + '\n';
}

export const today = () => new Date().toISOString().slice(0, 10);
