/**
 * Stateful property test: random sequences of scene edits, made with the kit's ops and its group and ungroup
 * actions, run through the scene's history. The model is the list of states each recorded entry left, so
 * every undo and redo is checked against the state the scene really had, and the tree is checked after every
 * step.
 */
import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import type { ImmediateInvoker } from '@weasel-js/routing';
import { createScene } from 'core/scene/scene';
import type { NodeId, Scene } from 'core/scene/types';
import type { RectPose } from 'core/geometry/rectPose';
import type { Op } from 'core/ops/types';
import { createInsertOp } from 'core/ops/create';
import { createDeleteOp } from 'core/ops/delete';
import { createReparentOp } from 'core/ops/reparent';
import { createTransformOp } from 'core/ops/transform';
import { createMoveToIndexOp, createReorderOp, type ReorderDirection } from 'core/ops/reorder';
import { createSetLayerOp } from 'core/ops/setLayer';
import { createSetHiddenOp, createSetLockedOp } from 'core/ops/nodeFlags';
import { createSetDependsOnOp } from 'core/ops/setDependsOn';
import { defaultCommitAdapter } from './defaultCommitAdapter';
import { groupAction, ungroupAction } from './defaults/group';

type S = Scene<Record<string, never>, 'main' | 'top', RectPose>;
interface Real { scene: S; adapter: ReturnType<typeof defaultCommitAdapter<RectPose>> }
interface Entry { state: unknown; before: readonly NodeId[]; after: readonly NodeId[] }
interface Model { entries: Entry[]; cursor: number }

const RUNS = { numRuns: Number(globalThis.process?.env?.WEASEL_PBT_RUNS) || 100 };

function makeReal(): Real {
  const scene = createScene<Record<string, never>, 'main' | 'top'>({ systemLayers: [{ id: 'main' }, { id: 'top' }] }) as S;
  return { scene, adapter: defaultCommitAdapter(scene) };
}

const snap = (scene: S): unknown => JSON.parse(JSON.stringify(scene.toJSON()));
const ids = (scene: S): NodeId[] => [...scene.nodes.keys()].sort();
const groups = (scene: S): NodeId[] => ids(scene).filter((id) => scene.get(id)!.kind === 'group');
const pickFrom = <T>(xs: readonly T[], k: number): T | undefined => (xs.length === 0 ? undefined : xs[k % xs.length]);

/** The scene's tree is a forest: each node sits exactly once, under a parent that lists it, and no cycle. */
function checkTree(scene: S): void {
  const seen = new Map<NodeId, number>();
  const visit = (id: NodeId, parent: NodeId | null, depth: number): void => {
    expect(depth).toBeLessThan(1000);
    seen.set(id, (seen.get(id) ?? 0) + 1);
    const node = scene.get(id);
    expect(node, `listed child ${id} is in the scene`).toBeDefined();
    expect(node!.parent ?? null, `parent of ${id}`).toBe(parent);
    for (const kid of scene.childrenOf(id)) visit(kid, id, depth + 1);
  };
  for (const root of scene.roots) visit(root, null, 0);
  for (const id of scene.nodes.keys()) expect(seen.get(id), `${id} appears once in the tree`).toBe(1);
  expect(seen.size).toBe(scene.nodes.size);
}

function checkInvariants(scene: S): void {
  checkTree(scene);
  for (const id of scene.getSelection()) expect(scene.get(id), `selected ${id} exists`).toBeDefined();
}

/** How many of each command did something, so a run that exercised nothing fails rather than passes. */
const tally = new Map<string, number>();
const count = (what: string): void => { tally.set(what, (tally.get(what) ?? 0) + 1); };

/** Record what an edit did: a new entry, or nothing at all. */
function settle(m: Model, r: Real, before: readonly NodeId[], what: string): void {
  const index = r.scene.historyIndex();
  if (index === m.cursor + 1) {
    count(what);
    m.entries.splice(m.cursor + 1);
    m.entries.push({ state: snap(r.scene), before, after: [...r.scene.getSelection()] });
    m.cursor++;
  } else {
    expect(index, 'an edit records one entry or none').toBe(m.cursor);
    expect(snap(r.scene), 'an edit that recorded nothing changed nothing').toEqual(m.entries[m.cursor]!.state);
  }
  expect(r.scene.historyEntries().length).toBe(m.entries.length - 1);
  checkInvariants(r.scene);
}

const pose = fc.record({
  x: fc.integer({ min: -100, max: 100 }), y: fc.integer({ min: -100, max: 100 }),
  width: fc.integer({ min: 1, max: 50 }), height: fc.integer({ min: 1, max: 50 }),
});

abstract class Edit implements fc.Command<Model, Real> {
  check(): boolean { return true; }
  run(m: Model, r: Real): void {
    const before = [...r.scene.getSelection()];
    this.edit(r);
    settle(m, r, before, this.constructor.name);
  }
  abstract edit(r: Real): void;
  abstract toString(): string;
}

/** Commit `ops` as one entry. The scene may refuse a batch (a cycle, a locked node, a child below its parent's
 *  layer) by throwing; `settle` then checks that it left nothing behind. */
const commit = (r: Real, ops: Op[], label: string): void => {
  try { r.scene.applyBatch(ops, label, r.adapter); } catch { count(`refused:${label}`); }
};

class Insert extends Edit {
  constructor(readonly group: boolean, readonly parent: number | null, readonly index: number, readonly pose: RectPose) { super(); }
  edit(r: Real): void {
    const parent = this.parent === null ? null : pickFrom(groups(r.scene), this.parent) ?? null;
    const node = {
      id: r.scene.mintId(), kind: this.group ? 'group' : 'mark', layer: 'main', pose: this.pose, data: {}, parent,
    };
    commit(r, [createInsertOp({ node, index: this.index })], 'Insert');
  }
  toString(): string { return `Insert(${this.group ? 'group' : 'mark'}, parent ${this.parent}, @${this.index})`; }
}

class Delete extends Edit {
  constructor(readonly pick: number) { super(); }
  edit(r: Real): void {
    const id = pickFrom(ids(r.scene), this.pick);
    if (id) commit(r, [createDeleteOp({ node: r.scene.get(id)! })], 'Delete');
  }
  toString(): string { return `Delete(${this.pick})`; }
}

class SetPose extends Edit {
  constructor(readonly pick: number, readonly pose: RectPose) { super(); }
  edit(r: Real): void {
    const id = pickFrom(ids(r.scene), this.pick);
    if (id) commit(r, [createTransformOp({ id, from: r.scene.get(id)!.pose, to: this.pose })], 'Move');
  }
  toString(): string { return `SetPose(${this.pick}, ${JSON.stringify(this.pose)})`; }
}

class Reparent extends Edit {
  constructor(readonly pick: number, readonly to: number | null, readonly index: number | undefined) { super(); }
  edit(r: Real): void {
    const id = pickFrom(ids(r.scene), this.pick);
    if (!id) return;
    const to = this.to === null ? null : pickFrom(groups(r.scene), this.to) ?? null;
    commit(r, [createReparentOp({
      id, fromParentId: r.scene.get(id)!.parent ?? null, toParentId: to,
      ...(this.index !== undefined ? { toIndex: this.index } : {}),
    })], 'Reparent');
  }
  toString(): string { return `Reparent(${this.pick} → ${this.to}, @${this.index})`; }
}

/** The rest of core's node ops: z-order, layer, the hidden and locked flags, and derivation. */
class Other extends Edit {
  constructor(readonly which: number, readonly pick: number, readonly other: number, readonly flag: boolean) { super(); }
  edit(r: Real): void {
    const all = ids(r.scene);
    const id = pickFrom(all, this.pick);
    if (!id) return;
    const node = r.scene.get(id)!;
    const directions: ReorderDirection[] = ['forward', 'backward', 'front', 'back'];
    switch (this.which % 6) {
      case 0: commit(r, [createReorderOp({ ids: [id, pickFrom(all, this.other)!], direction: directions[this.other % 4]! })], 'Reorder'); break;
      case 1: commit(r, [createMoveToIndexOp({ ids: [id], parentId: node.parent ?? null, index: this.other % 4 })], 'MoveToIndex'); break;
      case 2: commit(r, [createSetLayerOp({ id, from: node.layer, to: this.flag ? 'top' : 'main' })], 'SetLayer'); break;
      case 3: commit(r, [createSetHiddenOp({ id, from: node.hidden === true, to: this.flag })], 'SetHidden'); break;
      case 4: commit(r, [createSetLockedOp({ id, from: node.locked === true, to: this.flag })], 'SetLocked'); break;
      default: {
        const source = pickFrom(all, this.other)!;
        const from = node.dependsOn as readonly string[] | 'children' | undefined;
        commit(r, [createSetDependsOnOp({ id, from, to: this.flag && source !== id ? [source] : undefined })], 'SetDependsOn');
      }
    }
  }
  toString(): string { return `Other(${['reorder', 'moveToIndex', 'setLayer', 'setHidden', 'setLocked', 'setDependsOn'][this.which % 6]}, ${this.pick}, ${this.other}, ${this.flag})`; }
}

class Group implements fc.Command<Model, Real> {
  constructor(readonly picks: number[]) {}
  check(): boolean { return true; }
  run(m: Model, r: Real): void {
    // Selecting is not an edit, so the entry's "before" is the selection the action itself started from.
    const all = ids(r.scene);
    const chosen = [...new Set(this.picks.map((k) => pickFrom(all, k)).filter((id): id is NodeId => id !== undefined))];
    if (chosen.length > 0) r.scene.setSelection(chosen);
    const before = [...r.scene.getSelection()];
    if (chosen.length > 0) invoke(groupAction, r);
    settle(m, r, before, 'Group');
  }
  toString(): string { return `Group(${this.picks.join(',')})`; }
}

class Ungroup implements fc.Command<Model, Real> {
  constructor(readonly pick: number) {}
  check(): boolean { return true; }
  run(m: Model, r: Real): void {
    const id = pickFrom(groups(r.scene), this.pick);
    if (id) r.scene.setSelection([id]);
    const before = [...r.scene.getSelection()];
    if (id) invoke(ungroupAction, r);
    settle(m, r, before, 'Ungroup');
  }
  toString(): string { return `Ungroup(${this.pick})`; }
}

class Select implements fc.Command<Model, Real> {
  constructor(readonly picks: number[]) {}
  check(): boolean { return true; }
  run(m: Model, r: Real): void {
    const all = ids(r.scene);
    const at = r.scene.historyIndex();
    r.scene.setSelection([...new Set(this.picks.map((k) => pickFrom(all, k)).filter((id): id is NodeId => id !== undefined))]);
    expect(r.scene.historyIndex(), 'selecting is never an undo step').toBe(at);
    checkInvariants(r.scene);
  }
  toString(): string { return `Select(${this.picks.join(',')})`; }
}

class Undo implements fc.Command<Model, Real> {
  check(m: Readonly<Model>): boolean { return m.cursor > 0; }
  run(m: Model, r: Real): void {
    const undone = m.entries[m.cursor]!;
    // The engine keeps the selection an undo leaves, and a redo of that entry brings it back.
    undone.after = [...r.scene.getSelection()];
    expect(r.scene.undo()).toBe(true);
    count('Undo');
    m.cursor--;
    expect(snap(r.scene)).toEqual(m.entries[m.cursor]!.state);
    expect([...r.scene.getSelection()]).toEqual(undone.before.filter((id) => r.scene.get(id)));
    checkInvariants(r.scene);
  }
  toString(): string { return 'Undo'; }
}

class Redo implements fc.Command<Model, Real> {
  check(m: Readonly<Model>): boolean { return m.cursor < m.entries.length - 1; }
  run(m: Model, r: Real): void {
    const redone = m.entries[m.cursor + 1]!;
    redone.before = [...r.scene.getSelection()];
    expect(r.scene.redo()).toBe(true);
    count('Redo');
    m.cursor++;
    expect(snap(r.scene)).toEqual(redone.state);
    expect([...r.scene.getSelection()]).toEqual(redone.after.filter((id) => r.scene.get(id)));
    checkInvariants(r.scene);
  }
  toString(): string { return 'Redo'; }
}

/** Apply one op and then its inverse, recording neither: the scene must come back exactly. */
class OpThenInverse implements fc.Command<Model, Real> {
  constructor(readonly which: number, readonly pick: number, readonly to: number | null, readonly pose: RectPose) {}
  check(): boolean { return true; }
  run(m: Model, r: Real): void {
    const op = this.op(r);
    if (!op) return;
    const before = snap(r.scene);
    const at = r.scene.historyIndex();
    let refused = false;
    try {
      r.scene.untracked(() => {
        op.apply(r.adapter);
        op.invert().apply(r.adapter);
      });
    } catch {
      // A lock, a cycle, or a layer the scene refuses: `untracked` reverts what ran.
      refused = true;
    }
    expect(snap(r.scene)).toEqual(before);
    expect(r.scene.historyIndex()).toBe(at);
    count(refused ? `refused:OpThenInverse` : `OpThenInverse:${this.which % 4}`);
    checkInvariants(r.scene);
  }
  op(r: Real): Op | null {
    const all = ids(r.scene);
    const id = pickFrom(all, this.pick);
    switch (this.which % 4) {
      case 0: return createInsertOp({ node: { id: r.scene.mintId(), kind: 'mark', layer: id ? r.scene.get(id)!.layer : 'main', pose: this.pose, data: {}, parent: id ?? null }, index: this.pick % 3 });
      case 1: return id ? createDeleteOp({ node: r.scene.get(id)! }) : null;
      case 2: return id ? createTransformOp({ id, from: r.scene.get(id)!.pose, to: this.pose }) : null;
      default: {
        if (!id) return null;
        const to = this.to === null ? null : pickFrom(groups(r.scene), this.to) ?? null;
        if (to !== null && (to === id || r.scene.ancestorsOf(to).includes(id))) return null;
        return createReparentOp({ id, fromParentId: r.scene.get(id)!.parent ?? null, toParentId: to, toIndex: this.pick % 3 });
      }
    }
  }
  toString(): string { return `OpThenInverse(${['insert', 'delete', 'transform', 'reparent'][this.which % 4]}, ${this.pick}, ${this.to})`; }
}

/** Run a default action. One that throws (it would move or remove a locked descendant, which the scene refuses)
 *  must still leave the scene as it was, which `settle` checks. */
function invoke(action: typeof groupAction, r: Real): void {
  try {
    (action.invoker as ImmediateInvoker).run({ scene: r.scene, selection: selectionOf(r.scene) } as never, undefined as never);
  } catch {
    count(`refused:${action.id}`);
  }
}

/** Save the scene and its history as a page reload would, through JSON, and carry on in the scene rebuilt from
 *  them. Undo and redo afterwards must still land on the states the model holds. */
class Reload implements fc.Command<Model, Real> {
  check(): boolean { return true; }
  run(m: Model, r: Real): void {
    const json = JSON.parse(JSON.stringify(r.scene.toJSON()));
    const history = JSON.parse(JSON.stringify(r.scene.serializeHistory()));
    const selection = [...r.scene.getSelection()];
    const next = makeReal();
    next.scene.loadState(json);
    next.scene.setHistoryAdapter(() => next.adapter);
    next.scene.restoreHistory(history);
    next.scene.setSelection(selection);
    r.scene = next.scene;
    r.adapter = next.adapter;
    expect(snap(r.scene)).toEqual(m.entries[m.cursor]!.state);
    expect(r.scene.historyIndex()).toBe(m.cursor);
    expect(r.scene.historyEntries().length).toBe(m.entries.length - 1);
    count('Reload');
    checkInvariants(r.scene);
  }
  toString(): string { return 'Reload'; }
}

function selectionOf(scene: S) {
  return { get: () => [...scene.getSelection()], set: (next: NodeId[]) => scene.setSelection(next) };
}

const pick = fc.nat({ max: 50 });
const commands = fc.commands([
  fc.tuple(fc.boolean(), fc.option(pick, { nil: null }), fc.nat({ max: 4 }), pose).map(([g, p, i, q]) => new Insert(g, p, i, q)),
  fc.tuple(fc.boolean(), fc.option(pick, { nil: null }), fc.nat({ max: 4 }), pose).map(([g, p, i, q]) => new Insert(g, p, i, q)),
  pick.map((k) => new Delete(k)),
  fc.tuple(pick, pose).map(([k, q]) => new SetPose(k, q)),
  fc.tuple(pick, fc.option(pick, { nil: null }), fc.option(fc.nat({ max: 4 }), { nil: undefined })).map(([k, t, i]) => new Reparent(k, t, i)),
  fc.tuple(fc.nat(), pick, pick, fc.boolean()).map(([w, k, o, f]) => new Other(w, k, o, f)),
  fc.tuple(fc.nat(), pick, pick, fc.boolean()).map(([w, k, o, f]) => new Other(w, k, o, f)),
  fc.array(pick, { minLength: 1, maxLength: 4 }).map((ks) => new Group(ks)),
  pick.map((k) => new Ungroup(k)),
  fc.array(pick, { maxLength: 3 }).map((ks) => new Select(ks)),
  fc.constant(new Undo()),
  fc.constant(new Redo()),
  fc.constant(new Reload()),
  fc.tuple(fc.nat(), pick, fc.option(pick, { nil: null }), pose).map(([w, k, t, q]) => new OpThenInverse(w, k, t, q)),
], { maxCommands: 40, size: 'large' });

describe('scene ops through history, stateful property', () => {
  it('every step keeps the tree whole, and undo and redo return exactly the states the edits left', () => {
    fc.assert(fc.property(commands, (cmds) => {
      const real = makeReal();
      const model: Model = { entries: [{ state: snap(real.scene), before: [], after: [] }], cursor: 0 };
      fc.modelRun(() => ({ model, real }), cmds);
      // Undoing everything gives back the initial scene, and redoing everything the final one.
      const final = snap(real.scene);
      while (real.scene.canUndo()) real.scene.undo();
      expect(snap(real.scene)).toEqual(model.entries[0]!.state);
      while (real.scene.canRedo()) real.scene.redo();
      expect(snap(real.scene)).toEqual(model.entries.at(-1)!.state);
      if (model.cursor === model.entries.length - 1) expect(snap(real.scene)).toEqual(final);
      checkInvariants(real.scene);
    }), RUNS);
    for (const what of ['Insert', 'Delete', 'SetPose', 'Reparent', 'Other', 'Group', 'Ungroup', 'Undo', 'Redo', 'Reload',
      'OpThenInverse:0', 'OpThenInverse:1', 'OpThenInverse:2', 'OpThenInverse:3']) {
      expect(tally.get(what) ?? 0, `${what} ran ${JSON.stringify([...tally])}`).toBeGreaterThan(RUNS.numRuns / 50);
    }
  });
});
