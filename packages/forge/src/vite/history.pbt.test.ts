/**
 * `fileDates` against a model of a repository, through `fc.commands` runs of up to 120 commits that add, change,
 * rename, delete, and re-add files: after every commit, each live file's dates are the commit that began its
 * lineage, renames followed back, and the last commit that touched it, a rename included; a dead or never-made path
 * has none. `versionOf` reads a release back out of every spelling `git name-rev` gives one.
 */
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { runs, tally, timeoutFor } from '../pbt.fixture';
import { fileDates, versionOf } from './history';

const RUNS = 150;
const NAMES = ['a.ts', 'b.ts', 'pkg/c.tsx', 'pkg/é d.tsx', 'R.ts', 'D.ts', 'x/A.ts'];

interface Lineage {
  createdBy: number;
  modifiedBy: number;
}
interface Model {
  live: Map<string, Lineage>;
}
interface Real {
  /** Commits newest first, each its header and change lines. */
  commits: string[];
}
type Cmd = fc.Command<Model, Real>;

const t = tally();
const dateOf = (n: number) => new Date(Date.UTC(2026, 0, 1) + n * 3_600_000).toISOString();

function commit(m: Model, r: Real, changes: readonly string[]): void {
  const n = r.commits.length;
  r.commits.unshift([`\0c${n}\t${dateOf(n)}`, '', ...changes].join('\n'));
  const paths = [...m.live.keys(), ...NAMES.filter((name) => !m.live.has(name))];
  const got = fileDates(r.commits.join('\n'), paths);
  for (const path of paths) {
    const lineage = m.live.get(path);
    if (!lineage) expect(got.has(path)).toBe(false);
    else {
      expect(got.get(path)).toEqual({
        created: dateOf(lineage.createdBy),
        modified: dateOf(lineage.modifiedBy),
        createdBy: `c${lineage.createdBy}`,
        modifiedBy: `c${lineage.modifiedBy}`,
      });
    }
  }
}

const pick = (names: readonly string[], i: number) => names[i % names.length]!;

const add = fc.nat().map((i): Cmd => ({
  check: (m) => NAMES.some((n) => !m.live.has(n)),
  run(m, r) {
    const name = pick(NAMES.filter((n) => !m.live.has(n)), i);
    const n = r.commits.length;
    m.live.set(name, { createdBy: n, modifiedBy: n });
    commit(m, r, [`A\t${name}`]);
  },
  toString: () => `add(${i})`,
}));

const change = fc.tuple(fc.nat(), fc.constantFrom('M', 'T')).map(([i, status]): Cmd => ({
  check: (m) => m.live.size > 0,
  run(m, r) {
    const name = pick([...m.live.keys()], i);
    m.live.get(name)!.modifiedBy = r.commits.length;
    commit(m, r, [`${status}\t${name}`]);
    t.count('changed');
  },
  toString: () => `change(${i}, ${status})`,
}));

const rename = fc.tuple(fc.nat(), fc.nat(), fc.integer({ min: 50, max: 100 })).map(([i, j, score]): Cmd => ({
  check: (m) => m.live.size > 0 && m.live.size < NAMES.length,
  run(m, r) {
    const from = pick([...m.live.keys()], i);
    const to = pick(NAMES.filter((n) => !m.live.has(n)), j);
    const lineage = m.live.get(from)!;
    m.live.delete(from);
    m.live.set(to, { ...lineage, modifiedBy: r.commits.length });
    commit(m, r, [`R${String(score).padStart(3, '0')}\t${from}\t${to}`]);
    t.count('renamed');
  },
  toString: () => `rename(${i}, ${j}, ${score})`,
}));

const remove = fc.nat().map((i): Cmd => ({
  check: (m) => m.live.size > 0,
  run(m, r) {
    const name = pick([...m.live.keys()], i);
    m.live.delete(name);
    commit(m, r, [`D\t${name}`]);
    t.count('deleted');
  },
  toString: () => `remove(${i})`,
}));

/** Two files changed in one commit, or none, as a merge shows. */
const pair = fc.tuple(fc.nat(), fc.nat()).map(([i, j]): Cmd => ({
  check: () => true,
  run(m, r) {
    const live = [...m.live.keys()];
    const names = live.length === 0 ? [] : [...new Set([pick(live, i), pick(live, j)])];
    for (const name of names) m.live.get(name)!.modifiedBy = r.commits.length;
    commit(m, r, names.map((name) => `M\t${name}`));
  },
  toString: () => `pair(${i}, ${j})`,
}));

describe('fileDates', () => {
  it('dates every live file by its lineage after every commit, as the model does', () => {
    fc.assert(
      fc.property(fc.commands([add, add, change, change, rename, rename, remove, pair], { maxCommands: 120, size: '+1' }), (cmds) => {
        fc.modelRun(() => ({ model: { live: new Map() }, real: { commits: [] } }), cmds);
      }),
      runs(RUNS),
    );
    t.atLeast('renamed', 200);
    t.atLeast('deleted', 100);
    t.atLeast('changed', 200);
  }, timeoutFor(RUNS, 40));
});

describe('versionOf', () => {
  it('reads a release back from a tag, past any distance, and nothing from a name that is not one', () => {
    const version = fc
      .tuple(fc.nat(99), fc.nat(99), fc.nat(99), fc.constantFrom('', '-rc.1', '-beta', '+build.5'))
      .map(([a, b, c, pre]) => `${a}.${b}.${c}${pre}`);
    const distance = fc.array(fc.tuple(fc.constantFrom('~', '^'), fc.nat(9)).map(([s, n]) => `${s}${n || ''}`), { maxLength: 3 }).map((d) => d.join(''));
    fc.assert(
      fc.property(version, fc.constantFrom('', 'v', '@weasel-js/ui@', 'pkg@'), distance, fc.constantFrom('', '\n'), (v, prefix, d, end) => {
        expect(versionOf(`${prefix}${v}${d}${end}`)).toBe(v);
      }),
      runs(RUNS),
    );
    for (const named of ['', 'undefined', 'main', 'main~3', 'v1.2', 'release-1.2.3', 'x1.2.3']) expect(versionOf(named)).toBeNull();
  });
});
