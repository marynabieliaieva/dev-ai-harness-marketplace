// Minimal SemVer parsing, comparison and range matching — enough for the dependency
// ranges plugins declare (exact, ^, ~, >, >=, <, <=, *, x, space-separated AND).

const VERSION_RE = /^v?(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?(?:\+[0-9A-Za-z.-]+)?$/;

export function parse(version) {
  const m = VERSION_RE.exec(String(version).trim());
  if (!m) return undefined;
  return { major: +m[1], minor: +m[2], patch: +m[3], pre: m[4] ? m[4].split('.') : [] };
}

export const isValid = (version) => parse(version) !== undefined;

function comparePre(a, b) {
  if (!a.length || !b.length) return b.length - a.length; // release > prerelease
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    if (a[i] === undefined) return -1;
    if (b[i] === undefined) return 1;
    const na = /^\d+$/.test(a[i]);
    const nb = /^\d+$/.test(b[i]);
    if (na && nb && +a[i] !== +b[i]) return +a[i] - +b[i];
    if (na !== nb) return na ? -1 : 1;
    if (a[i] !== b[i]) return a[i] < b[i] ? -1 : 1;
  }
  return 0;
}

/** Negative, zero or positive, like a sort comparator. */
export function compare(a, b) {
  const x = typeof a === 'string' ? parse(a) : a;
  const y = typeof b === 'string' ? parse(b) : b;
  return x.major - y.major || x.minor - y.minor || x.patch - y.patch || comparePre(x.pre, y.pre);
}

function comparatorSet(token) {
  if (token === '*' || token === 'x' || token === '') return [() => true];
  const m = /^(\^|~|>=|<=|>|<|=)?(.+)$/.exec(token);
  const op = m[1] ?? '=';
  const v = parse(m[2]);
  if (!v) throw new Error(`invalid version range "${token}"`);
  const ge = (x) => compare(x, v) >= 0;
  switch (op) {
    case '^': {
      const upper = v.major > 0 ? { ...v, major: v.major + 1, minor: 0, patch: 0, pre: [] }
        : v.minor > 0 ? { ...v, minor: v.minor + 1, patch: 0, pre: [] }
        : { ...v, patch: v.patch + 1, pre: [] };
      return [ge, (x) => compare(x, upper) < 0];
    }
    case '~':
      return [ge, (x) => compare(x, { ...v, minor: v.minor + 1, patch: 0, pre: [] }) < 0];
    case '>=': return [ge];
    case '>': return [(x) => compare(x, v) > 0];
    case '<=': return [(x) => compare(x, v) <= 0];
    case '<': return [(x) => compare(x, v) < 0];
    default: return [(x) => compare(x, v) === 0];
  }
}

/** True when `version` satisfies every comparator in `range` (whitespace = AND). */
export function satisfies(version, range = '*') {
  const v = parse(version);
  if (!v) return false;
  return String(range).trim().split(/\s+/).flatMap(comparatorSet).every((test) => test(v));
}

/** Highest version in `versions` that satisfies `range`, or undefined. */
export function maxSatisfying(versions, range) {
  return versions.filter((v) => satisfies(v, range)).sort(compare).at(-1);
}
