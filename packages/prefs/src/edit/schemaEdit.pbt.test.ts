/**
 * Stateful property test of the schema editor's edits on a schema of groups and leaves: adds, removals, renames,
 * and moves of several nodes at once, against a model of the tree. Every step checks the tree's keys, order, and
 * nodes, that an edit refused throws a documented error and leaves the schema as it was, and that an edit that
 * changes nothing hands back the schema itself. Keys include `Object.prototype`'s names.
 */
import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import type { PrefGroup, PrefLeaf } from '@weasel-js/prefs';
import { runs, tally, timeoutFor } from '../pbt.fixture';
import { addNode, childrenOf, moveNodes, nodeAt, outermost, removeNodes, renameKey, type SchemaNode } from './schemaEdit';

const RUNS = 120;
const KEYS = ['a', 'b', 'c', 'constructor', 'toString', 'valueOf', 'hasOwnProperty'];

interface MNode { key: string; node: SchemaNode | null; kids: MNode[] | null }
interface Model { kids: MNode[]; made: number }
interface Real { root: PrefGroup }

const tl = tally();

/** A model node's tree, as `[key, leaf name or group, kids]`. */
const outlineOf = (kids: readonly MNode[]): unknown => kids.map((k) => [k.key, k.kids ? outlineOf(k.kids) : (k.node as PrefLeaf).name]);
function realOutline(node: SchemaNode): unknown {
  const kids = childrenOf(node)!;
  return Object.keys(kids).map((k) => {
    const c = kids[k]!;
    return [k, childrenOf(c) ? realOutline(c) : (c as PrefLeaf).name];
  });
}

function groupPaths(kids: readonly MNode[], at: string | null = null): (string | null)[] {
  return [at, ...kids.flatMap((k) => (k.kids ? groupPaths(k.kids, at === null ? k.key : `${at}/${k.key}`) : []))];
}
function allPaths(kids: readonly MNode[], at: string | null = null): string[] {
  return kids.flatMap((k) => {
    const p = at === null ? k.key : `${at}/${k.key}`;
    return [p, ...(k.kids ? allPaths(k.kids, p) : [])];
  });
}
function listAt(m: Model, path: string | null): MNode[] {
  let list = m.kids;
  for (const k of path === null ? [] : path.split('/')) list = list.find((n) => n.key === k)!.kids!;
  return list;
}
const parentOf = (p: string): string | null => (p.includes('/') ? p.slice(0, p.lastIndexOf('/')) : null);
const keyOfPath = (p: string): string => p.slice(p.lastIndexOf('/') + 1);
const under = (p: string, a: string) => p.startsWith(`${a}/`);
const uniq = (taken: readonly string[], base: string): string => {
  if (!taken.includes(base)) return base;
  let n = 2;
  while (taken.includes(`${base}${n}`)) n++;
  return `${base}${n}`;
};

function check(m: Model, r: Real): void {
  expect(realOutline(r.root)).toEqual(outlineOf(m.kids));
}

/** Run `act`, expecting a refusal when `refused`: an `Error` naming the editor, and the schema left as it was. */
function attempt(r: Real, refused: boolean, act: () => PrefGroup): PrefGroup | null {
  if (!refused) return act();
  const before = r.root;
  expect(act).toThrow(/^schemaEdit: /);
  expect(r.root).toBe(before);
  tl.count('refused');
  return null;
}

class Add implements fc.Command<Model, Real> {
  constructor(readonly pick: number, readonly key: string, readonly group: boolean, readonly index: number | undefined) {}
  check = () => true;
  run(m: Model, r: Real): void {
    const parents = groupPaths(m.kids);
    const parent = parents[this.pick % parents.length]!;
    const list = listAt(m, parent);
    const name = `n${m.made++}`;
    const node: SchemaNode = this.group ? ({ name, children: {} } as PrefGroup) : ({ kind: 'boolean', name, default: false } as PrefLeaf);
    const out = attempt(r, list.some((n) => n.key === this.key), () => addNode(r.root, parent, this.key, node, this.index));
    if (out === null) return;
    const at = Math.max(0, Math.min(this.index ?? list.length, list.length));
    list.splice(at, 0, { key: this.key, node, kids: this.group ? [] : null });
    r.root = out;
    expect(nodeAt(r.root, parent === null ? this.key : `${parent}/${this.key}`)).toBe(node);
    tl.count('add');
    check(m, r);
  }
  toString = () => `add(${this.pick}, ${this.key}, ${this.group ? 'group' : 'leaf'}, ${this.index})`;
}

class Remove implements fc.Command<Model, Real> {
  constructor(readonly picks: number[]) {}
  check = (m: Readonly<Model>) => allPaths(m.kids).length > 0;
  run(m: Model, r: Real): void {
    const paths = allPaths(m.kids);
    const gone = this.picks.map((i) => paths[i % paths.length]!);
    r.root = removeNodes(r.root, gone);
    for (const p of outermost(gone).sort((x, y) => y.split('/').length - x.split('/').length)) {
      const list = listAt(m, parentOf(p));
      const i = list.findIndex((n) => n.key === keyOfPath(p));
      if (i >= 0) list.splice(i, 1);
    }
    tl.count('remove');
    check(m, r);
  }
  toString = () => `remove(${this.picks})`;
}

class Rename implements fc.Command<Model, Real> {
  constructor(readonly pick: number, readonly key: string) {}
  check = (m: Readonly<Model>) => allPaths(m.kids).length > 0;
  run(m: Model, r: Real): void {
    const paths = allPaths(m.kids);
    const path = paths[this.pick % paths.length]!;
    const list = listAt(m, parentOf(path));
    const was = keyOfPath(path);
    if (was === this.key) {
      expect(renameKey(r.root, path, this.key)).toBe(r.root);
      tl.count('rename to itself');
      return;
    }
    const out = attempt(r, list.some((n) => n.key === this.key), () => renameKey(r.root, path, this.key));
    if (out === null) return;
    list.find((n) => n.key === was)!.key = this.key;
    r.root = out;
    tl.count('rename');
    check(m, r);
  }
  toString = () => `rename(${this.pick}, ${this.key})`;
}

class Move implements fc.Command<Model, Real> {
  constructor(readonly picks: number[], readonly to: number, readonly index: number) {}
  check = (m: Readonly<Model>) => allPaths(m.kids).length > 0;
  run(m: Model, r: Real): void {
    const paths = allPaths(m.kids);
    const asked = this.picks.map((i) => paths[i % paths.length]!);
    const moving = [...new Set(asked)];
    const dests = groupPaths(m.kids);
    const dest = dests[this.to % dests.length]!;
    const tops = outermost(moving);
    const into = dest !== null && tops.some((p) => dest === p || under(dest, p));
    const before = r.root;
    const out = attempt(r, into, () => moveNodes(r.root, asked, { parentPath: dest, index: this.index }).root);
    if (out === null) return;
    const destKeys = listAt(m, dest).map((n) => n.key);
    const shift = tops.filter((p) => parentOf(p) === dest && destKeys.indexOf(keyOfPath(p)) < this.index).length;
    const taken: MNode[] = [];
    for (const p of tops) {
      const list = listAt(m, parentOf(p));
      taken.push(list.splice(list.findIndex((n) => n.key === keyOfPath(p)), 1)[0]!);
    }
    const target = listAt(m, dest);
    const keys = target.map((n) => n.key);
    for (const n of taken) { n.key = uniq(keys, n.key); keys.push(n.key); }
    target.splice(Math.max(0, Math.min(this.index - shift, target.length)), 0, ...taken);
    r.root = out;
    if (JSON.stringify(realOutline(before)) === JSON.stringify(outlineOf(m.kids))) {
      expect(out).toBe(before);
      tl.count('move in place');
    } else tl.count(taken.some((n) => n.key.endsWith('2')) ? 'move renamed' : 'move');
    check(m, r);
  }
  toString = () => `move(${this.picks}, ${this.to}, ${this.index})`;
}

describe('schema edits', () => {
  it('match a model of the tree', () => {
    const pickArb = fc.nat(40);
    const add = fc.tuple(pickArb, fc.constantFrom(...KEYS), fc.boolean(), fc.option(fc.integer({ min: -1, max: 5 }), { nil: undefined })).map(([p, k, g, i]) => new Add(p, k, g, i));
    const commands = fc.commands([
      add, add, add,
      fc.tuple(pickArb, fc.constantFrom(...KEYS), fc.boolean(), fc.option(fc.integer({ min: -1, max: 5 }), { nil: undefined })).map(([p, k, g, i]) => new Add(p, k, g, i)),
      fc.array(pickArb, { minLength: 1, maxLength: 3 }).map((ps) => new Remove(ps)),
      fc.tuple(pickArb, fc.constantFrom(...KEYS)).map(([p, k]) => new Rename(p, k)),
      fc.tuple(fc.array(pickArb, { minLength: 1, maxLength: 3 }), pickArb, fc.integer({ min: -1, max: 6 })).map(([ps, t, i]) => new Move(ps, t, i)),
    ], { maxCommands: 60, size: 'medium' });
    fc.assert(fc.property(commands, (cmds) => {
      fc.modelRun(() => ({ model: { kids: [], made: 0 }, real: { root: { name: 'Root', children: {} } as PrefGroup } }), cmds);
    }), runs(RUNS));
    for (const k of ['add', 'remove', 'rename', 'move', 'move renamed', 'move in place', 'refused', 'rename to itself']) tl.atLeast(k, 10);
  }, timeoutFor(RUNS, 40));
});

describe('moveNodes, shrunk', () => {
  it('moves a path named twice once', () => {
    const leaf = { kind: 'boolean', name: 'n0', default: false } as PrefLeaf;
    const root = { name: 'Root', children: { a: leaf } } as PrefGroup;
    const moved = moveNodes(root, ['a', 'a'], { parentPath: null, index: 0 });
    expect(moved.root).toBe(root);
    expect(Object.keys(moved.root.children)).toEqual(['a']);
  });
});
