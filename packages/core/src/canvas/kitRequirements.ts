/**
 * Version negotiation for contributions: a `requires` map of semver ranges,
 * matched against the versions the running kit packages report.
 *
 * The range grammar is npm's everyday subset — `^`, `~`, `>=`, `>`, `<=`, `<`,
 * `=`, bare and partial versions (`1.7`, `1.x`, `*`), space for AND and `||`
 * for OR. Hyphen ranges are not read. A prerelease orders below its release,
 * without npm's rule that a range must opt into prereleases by naming one.
 */
import { VERSION } from '../version';

/**
 * The versions a contribution can require, keyed by package without its
 * `@weasel-js/` scope. Only core reports its version today.
 */
export interface KitVersions {
  core: string;
}

/** A contribution's `requires`: a semver range per package it was written against. */
export type KitRequirements = { readonly [K in keyof KitVersions]?: string };

/** The running kit's versions. */
export const KIT_VERSIONS: Readonly<KitVersions> = { core: VERSION };

/** One requirement the running kit does not meet. */
export interface RequirementMismatch {
  package: string;
  range: string;
  /** The running version, or `undefined` when that package reports none. */
  running: string | undefined;
  reason: 'unsatisfied' | 'invalid-range' | 'unknown-package';
}

type Triple = readonly [number, number, number];
interface Version { triple: Triple; pre: readonly (string | number)[] }
interface Comparator { op: '>=' | '<' | '>' | '<='; v: Version }

const UNKNOWN_SUFFIX = '-unknown';
const VERSION_RE = /^v?(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?(?:\+[0-9A-Za-z.-]+)?$/;
const PARTIAL_RE = /^v?(\d+|[xX*])(?:\.(\d+|[xX*]))?(?:\.(\d+|[xX*]))?(?:-([0-9A-Za-z.-]+))?(?:\+[0-9A-Za-z.-]+)?$/;

function preOf(s: string | undefined): (string | number)[] {
  return s ? s.split('.').map((id) => (/^\d+$/.test(id) ? Number(id) : id)) : [];
}

function parseVersion(s: string): Version | null {
  const m = VERSION_RE.exec(s.trim());
  return m ? { triple: [Number(m[1]), Number(m[2]), Number(m[3])], pre: preOf(m[4]) } : null;
}

function compare(a: Version, b: Version): number {
  for (let i = 0; i < 3; i++) {
    const d = a.triple[i]! - b.triple[i]!;
    if (d !== 0) return d;
  }
  if (a.pre.length === 0 || b.pre.length === 0) return b.pre.length - a.pre.length;
  for (let i = 0; i < Math.max(a.pre.length, b.pre.length); i++) {
    const x = a.pre[i];
    const y = b.pre[i];
    if (x === undefined) return -1;
    if (y === undefined) return 1;
    if (x === y) continue;
    if (typeof x === 'number' && typeof y === 'number') return x - y;
    if (typeof x === 'number') return -1;
    if (typeof y === 'number') return 1;
    return x < y ? -1 : 1;
  }
  return 0;
}

const v = (a: number, b: number, c: number, pre: readonly (string | number)[] = []): Version =>
  ({ triple: [a, b, c], pre });

/** One comparator token as the interval it names. `null` when unreadable. */
function parseComparator(token: string): Comparator[] | null {
  const m = /^(\^|~|>=|<=|>|<|=)?(.*)$/.exec(token)!;
  const op = m[1] ?? '';
  const p = PARTIAL_RE.exec(m[2]!);
  if (!p) return null;
  const nums: number[] = [];
  for (const part of [p[1], p[2], p[3]]) {
    if (part === undefined || /^[xX*]$/.test(part)) break;
    nums.push(Number(part));
  }
  const pre = preOf(p[4]);
  if (pre.length > 0 && nums.length < 3) return null;
  const [M = 0, mi = 0, pa = 0] = nums;
  const lower = v(M, mi, pa, pre);
  // The first version past everything the partial names: `1.7` → `1.8.0`.
  const upper = nums.length === 0 ? null
    : nums.length === 1 ? v(M + 1, 0, 0)
    : nums.length === 2 ? v(M, mi + 1, 0)
    : v(M, mi, pa + 1);

  switch (op) {
    case '>=': return [{ op: '>=', v: lower }];
    case '<': return nums.length === 0 ? [{ op: '<', v: v(0, 0, 0) }] : [{ op: '<', v: lower }];
    case '>': return nums.length === 3 ? [{ op: '>', v: lower }] : upper ? [{ op: '>=', v: upper }] : [{ op: '<', v: v(0, 0, 0) }];
    case '<=': return nums.length === 3 ? [{ op: '<=', v: lower }] : upper ? [{ op: '<', v: upper }] : [];
    case '~': {
      const top = nums.length <= 1 ? v(M + 1, 0, 0) : v(M, mi + 1, 0);
      return [{ op: '>=', v: lower }, { op: '<', v: top }];
    }
    case '^': {
      const top = M > 0 || nums.length === 1 ? v(M + 1, 0, 0)
        : mi > 0 || nums.length === 2 ? v(0, mi + 1, 0)
        : v(0, 0, pa + 1);
      return nums.length === 0 ? [] : [{ op: '>=', v: lower }, { op: '<', v: top }];
    }
    default:
      if (nums.length === 3) return [{ op: '>=', v: lower }, { op: '<=', v: lower }];
      return upper ? [{ op: '>=', v: lower }, { op: '<', v: upper }] : [];
  }
}

function holds(version: Version, c: Comparator): boolean {
  const d = compare(version, c.v);
  switch (c.op) {
    case '>=': return d >= 0;
    case '>': return d > 0;
    case '<=': return d <= 0;
    case '<': return d < 0;
  }
}

/**
 * Whether `version` falls in `range`. `null` when either cannot be read, so a
 * caller can tell a mismatch from a requirement it could not check.
 */
export function satisfiesRange(version: string, range: string): boolean | null {
  const parsed = parseVersion(version);
  if (!parsed) return null;
  const alternatives = range.split('||').map((alt) => alt.trim());
  let any = false;
  for (const alt of alternatives) {
    if (alt === '') return null;
    const set: Comparator[] = [];
    for (const token of alt.split(/\s+/)) {
      const cs = parseComparator(token);
      if (!cs) return null;
      set.push(...cs);
    }
    if (set.every((c) => holds(parsed, c))) any = true;
  }
  return any;
}

/**
 * Every requirement in `requires` the running kit does not meet. A package
 * whose build does not know its own version (`0.0.0-unknown`, core's source
 * bundled without its define) is skipped: nothing can be said about it.
 */
export function checkRequirements(
  requires: KitRequirements,
  running: Readonly<Partial<Record<string, string>>> = KIT_VERSIONS,
): RequirementMismatch[] {
  const out: RequirementMismatch[] = [];
  for (const [pkg, range] of Object.entries(requires)) {
    if (range === undefined) continue;
    const have = running[pkg];
    if (have === undefined) {
      out.push({ package: pkg, range, running: undefined, reason: 'unknown-package' });
      continue;
    }
    if (have.endsWith(UNKNOWN_SUFFIX)) continue;
    const ok = satisfiesRange(have, range);
    if (ok === null) out.push({ package: pkg, range, running: have, reason: 'invalid-range' });
    else if (!ok) out.push({ package: pkg, range, running: have, reason: 'unsatisfied' });
  }
  return out;
}
