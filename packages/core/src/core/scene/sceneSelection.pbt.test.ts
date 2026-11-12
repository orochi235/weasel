/**
 * Stateful property test of the scene's selection: random adds, removals, moves, locks, hides, layer locks,
 * selections, undo, and redo. A write keeps exactly the ids a plain model keeps (each once, in reach, none under
 * another of them); an edit only ever takes ids out, never one a removal took or one a lock or hide put out of
 * reach, and never one held by a selected ancestor.
 */
import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { runs, tally, timeoutFor } from '../pbt.fixture';
import { createScene } from './scene';
import type { NodeId } from './types';

type Pose = { x: number; y: number; width: number; height: number };
const make = () => createScene<Record<string, never>, 'a' | 'b', Pose>({ systemLayers: [{ id: 'a' }, { id: 'b' }] });
type S = ReturnType<typeof make>;
interface Real { scene: S }
type Model = Record<string, never>;

const N = 150;
const T = timeoutFor(N, 20);
const t = tally();
const POSE: Pose = { x: 0, y: 0, width: 1, height: 1 };
const GHOST = 'ghost' as NodeId;

const ids = (s: S): NodeId[] => [...s.nodes.keys()].sort();
const pick = <T>(xs: readonly T[], k: number): T | undefined => (xs.length === 0 ? undefined : xs[k % xs.length]);

/** What the selection should hold after a write of `next`: each id once, at its first place, in reach, and none
 *  with an ancestor among the others. An id the scene does not hold is never kept. */
function legal(s: S, next: readonly NodeId[]): NodeId[] {
  const unique = [...new Set(next)];
  const inReach = unique.filter((id) => s.get(id) !== undefined && !s.isLocked(id) && !s.isHidden(id));
  const set = new Set(inReach);
  return inReach.filter((id) => !s.ancestorsOf(id).some((a) => set.has(a)));
}

/** After an edit, the selection is the one before it with ids taken out, and those it holds are legal. */
function checkNarrowed(s: S, before: readonly NodeId[], what: string): void {
  const now = s.getSelection();
  const kept = before.filter((id) => now.includes(id));
  expect([...now], `${what} only takes ids out`).toEqual(kept);
  expect([...now], `${what} leaves a legal selection`).toEqual(legal(s, now));
  for (const id of before) {
    if (!now.includes(id)) {
      const node = s.get(id);
      const why = node === undefined ? 'gone' : s.isLocked(id) ? 'locked' : s.isHidden(id) ? 'hidden' : 'held';
      if (why === 'held') expect(s.ancestorsOf(id).some((a) => now.includes(a)), `${id} left only for an ancestor`).toBe(true);
      t.count(`dropped:${why}`);
    }
  }
}

abstract class Edit implements fc.Command<Model, Real> {
  check(): boolean { return true; }
  run(_m: Model, r: Real): void {
    const before = [...r.scene.getSelection()];
    try {
      if (this.edit(r.scene) === false) return;
      t.count(this.constructor.name);
    } catch {
      t.count(`refused:${this.constructor.name}`);
    }
    checkNarrowed(r.scene, before, this.toString());
  }
  abstract edit(s: S): boolean | void;
  abstract toString(): string;
}

class Add extends Edit {
  constructor(readonly group: boolean, readonly parent: number | null, readonly layer: 'a' | 'b') { super(); }
  edit(s: S): void {
    const groups = ids(s).filter((id) => s.get(id)!.kind === 'group');
    const parent = this.parent === null ? undefined : pick(groups, this.parent);
    s.add({ kind: this.group ? 'group' : 'mark', layer: parent ? s.get(parent)!.layer : this.layer, pose: POSE, data: {}, ...(parent ? { parent } : {}) });
  }
  toString(): string { return `Add(${this.group ? 'group' : 'mark'}, ${this.parent}, ${this.layer})`; }
}

class Remove extends Edit {
  constructor(readonly k: number) { super(); }
  edit(s: S): boolean { const id = pick(ids(s), this.k); if (!id) return false; s.remove(id); return true; }
  toString(): string { return `Remove(${this.k})`; }
}

class Move extends Edit {
  constructor(readonly k: number, readonly to: number | null) { super(); }
  edit(s: S): boolean {
    const id = pick(ids(s), this.k);
    if (!id) return false;
    const groups = ids(s).filter((g) => s.get(g)!.kind === 'group');
    s.move(id, this.to === null ? null : pick(groups, this.to) ?? null);
    return true;
  }
  toString(): string { return `Move(${this.k} → ${this.to})`; }
}

/** Move a selected node under a selected group, so the selection must let go of it. */
class Nest extends Edit {
  constructor(readonly k: number) { super(); }
  edit(s: S): boolean {
    const sel = s.getSelection().filter((id) => s.get(id));
    const group = sel.find((id) => s.get(id)!.kind === 'group');
    const id = pick(sel.filter((x) => x !== group), this.k);
    if (!group || !id) return false;
    s.move(id, group);
    return true;
  }
  toString(): string { return `Nest(${this.k})`; }
}

class Flag extends Edit {
  constructor(readonly k: number, readonly which: 'locked' | 'hidden' | 'layer', readonly on: boolean) { super(); }
  edit(s: S): boolean {
    if (this.which === 'layer') { s.setLayerLocked(this.k % 2 ? 'b' : 'a', this.on); return true; }
    const id = pick(ids(s), this.k);
    if (!id) return false;
    if (this.which === 'locked') s.setLocked(id, this.on);
    else s.setHidden(id, this.on);
    return true;
  }
  toString(): string { return `Flag(${this.k}, ${this.which}, ${this.on})`; }
}

class Select implements fc.Command<Model, Real> {
  constructor(readonly picks: (number | null)[]) {}
  check(): boolean { return true; }
  run(_m: Model, r: Real): void {
    const all = ids(r.scene);
    const next = this.picks.map((k) => (k === null ? GHOST : pick(all, k) ?? GHOST));
    const at = r.scene.historyIndex();
    r.scene.setSelection(next);
    expect([...r.scene.getSelection()]).toEqual(legal(r.scene, next));
    expect(r.scene.historyIndex(), 'selecting is never an undo step').toBe(at);
    if (legal(r.scene, next).length < new Set(next).size) t.count('Select:narrowed');
    t.count('Select');
  }
  toString(): string { return `Select(${this.picks.join(',')})`; }
}

class Undo implements fc.Command<Model, Real> {
  check(): boolean { return true; }
  run(_m: Model, r: Real): void {
    if (!r.scene.undo()) return;
    t.count('Undo');
    const now = r.scene.getSelection();
    expect(new Set(now).size).toBe(now.length);
    for (const id of now) if (r.scene.get(id)) expect(r.scene.ancestorsOf(id).some((a) => now.includes(a))).toBe(false);
  }
  toString(): string { return 'Undo'; }
}

class Redo implements fc.Command<Model, Real> {
  check(): boolean { return true; }
  run(_m: Model, r: Real): void {
    if (!r.scene.redo()) return;
    t.count('Redo');
    const now = r.scene.getSelection();
    expect(new Set(now).size).toBe(now.length);
  }
  toString(): string { return 'Redo'; }
}

const k = fc.nat({ max: 30 });
const commands = fc.commands([
  fc.tuple(fc.boolean(), fc.option(k, { nil: null }), fc.constantFrom<'a' | 'b'>('a', 'b')).map(([g, p, l]) => new Add(g, p, l)),
  fc.tuple(fc.boolean(), fc.option(k, { nil: null }), fc.constantFrom<'a' | 'b'>('a', 'b')).map(([g, p, l]) => new Add(g, p, l)),
  k.map((x) => new Remove(x)),
  fc.tuple(k, fc.option(k, { nil: null })).map(([a, b]) => new Move(a, b)),
  fc.tuple(k, fc.constantFrom<'locked' | 'hidden' | 'layer'>('locked', 'hidden', 'hidden', 'locked', 'layer'), fc.boolean()).map(([a, w, on]) => new Flag(a, w, on)),
  fc.array(fc.option(k, { nil: null, freq: 8 }), { maxLength: 5 }).map((ps) => new Select(ps)),
  fc.array(fc.option(k, { nil: null, freq: 8 }), { maxLength: 5 }).map((ps) => new Select(ps)),
  k.map((x) => new Nest(x)),
  k.map((x) => new Nest(x)),
  fc.constant(new Undo()),
  fc.constant(new Redo()),
], { maxCommands: 40, size: 'large' });

describe('scene selection, stateful property', () => {
  it('every write keeps exactly the legal ids, and every edit only takes ids out, each for a reason', () => {
    fc.assert(fc.property(commands, (cmds) => {
      fc.modelRun(() => ({ model: {}, real: { scene: make() } }), cmds);
    }), runs(N));
    for (const what of ['Add', 'Remove', 'Move', 'Nest', 'Flag', 'Select', 'Select:narrowed', 'Undo', 'Redo', 'dropped:gone', 'dropped:locked', 'dropped:hidden', 'dropped:held']) {
      t.atLeast(what, 5);
    }
  }, T);
});
