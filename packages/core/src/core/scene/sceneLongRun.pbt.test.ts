/**
 * Second-pass stateful test of the scene: long runs (up to 100 steps) mixing node edits, z-order (`reorder` and
 * `move` at any index, finite or not), layers added, moved, renamed, and removed, document values, page edits,
 * undo, redo, history jumps, and a reload of the document and its history into a fresh scene. Ids, layer ids,
 * page ids, and document keys are often named like `Object.prototype` members. The model is the snapshot each
 * recorded entry left, so every undo, redo, and jump lands on a state the scene really had; an edit records one
 * entry or none, and one that throws or records nothing leaves the document as it was. After every step the tree
 * is a forest, the render order lists each node once, and the snapshot reads back to itself after one round.
 */
import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { runs, tally, timeoutFor } from '../pbt.fixture';
import { createScene, sceneFromJSON } from './scene';
import { asNodeId, type NodeId, type Scene } from './types';
import { addPage, movePage, nextPageId, pagesOf, removePage } from '../pages/pageEdits';

type Pose = { x: number; y: number; width: number; height: number };
type S = Scene<Record<string, unknown>, string, Pose>;
interface Real { scene: S }
interface Model { states: unknown[] }

const N = 60;
const T = timeoutFor(N, 400);
const t = tally();

const NAMES = ['__proto__', 'toString', 'constructor', 'hasOwnProperty', 'valueOf', 'isPrototypeOf'];
const make = (): S => createScene<Record<string, unknown>, string, Pose>({ systemLayers: [{ id: 'base' }, { id: 'toString' }] }) as S;
const json = (s: S): unknown => JSON.parse(JSON.stringify(s.toJSON()));
const pick = <X>(xs: readonly X[], k: number): X | undefined => (xs.length === 0 ? undefined : xs[k % xs.length]);
const nodeIds = (s: S): NodeId[] => [...s.nodes.keys()].sort();
const groups = (s: S): NodeId[] => nodeIds(s).filter((id) => s.get(id)!.kind === 'group');
const layerIds = (s: S): string[] => s.layers.map((l) => l.id);

function checkTree(s: S): void {
  const seen = new Map<NodeId, number>();
  const visit = (id: NodeId, parent: NodeId | null, depth: number): void => {
    expect(depth).toBeLessThan(200);
    seen.set(id, (seen.get(id) ?? 0) + 1);
    const node = s.get(id);
    expect(node, `listed child ${id} is in the scene`).toBeDefined();
    expect(node!.parent ?? null, `parent of ${id}`).toBe(parent);
    for (const kid of s.childrenOf(id)) visit(kid, id, depth + 1);
  };
  for (const root of s.roots) visit(root, null, 0);
  for (const id of s.nodes.keys()) expect(seen.get(id), `${id} sits once in the tree`).toBe(1);
  const order = [...s.renderOrder()];
  expect(new Set(order).size, 'the render order lists each node once').toBe(order.length);
  for (const id of order) expect(s.get(id), `rendered ${id} is in the scene`).toBeDefined();
}

/** The snapshot reads back to itself, and a snapshot of what it read back reads back to that. */
function checkFixedPoint(s: S): void {
  const once = json(s);
  const back = json(sceneFromJSON(once as never) as S);
  expect(back, 'a snapshot reads back to itself').toEqual(once);
  expect(json(sceneFromJSON(back as never) as S)).toEqual(back);
}

abstract class Edit implements fc.Command<Model, Real> {
  check(): boolean { return true; }
  run(m: Model, r: Real): void {
    const s = r.scene;
    const before = s.historyIndex();
    const was = m.states[before];
    let threw = false;
    try {
      this.edit(s);
    } catch (e) {
      threw = true;
      expect(e, String(e)).toBeInstanceOf(Error);
      expect(e instanceof TypeError || e instanceof RangeError, `${this} throws on purpose: ${String(e)}`).toBe(false);
    }
    const index = s.historyIndex();
    if (!threw && index === before + 1) {
      m.states.length = before + 1;
      m.states.push(json(s));
      t.count(this.constructor.name);
    } else {
      expect(index, `${this} records one entry or none`).toBe(before);
      expect(json(s), `${this} that ${threw ? 'threw' : 'recorded nothing'} changed nothing`).toEqual(was);
      t.count(`${threw ? 'refused' : 'noop'}:${this.constructor.name}`);
    }
    checkTree(s);
  }
  abstract edit(s: S): void;
  abstract toString(): string;
}

const POSE = fc.record({ x: fc.integer({ min: -500, max: 500 }), y: fc.integer({ min: -500, max: 500 }), width: fc.integer({ min: 0, max: 99 }), height: fc.integer({ min: 0, max: 99 }) });
const INDEX = fc.oneof(fc.integer({ min: -2, max: 8 }), fc.constantFrom(NaN, Infinity, -Infinity, 1.5, -0));

class Add extends Edit {
  constructor(readonly group: boolean, readonly parent: number | null, readonly layer: number, readonly name: number | null, readonly pose: Pose, readonly index: number | undefined) { super(); }
  edit(s: S): void {
    const parent = this.parent === null ? undefined : pick(groups(s), this.parent);
    const layer = parent ? s.get(parent)!.layer : pick(layerIds(s), this.layer)!;
    const id = this.name === null ? undefined : asNodeId(NAMES[this.name % NAMES.length]!);
    s.add({ kind: this.group ? 'group' : 'mark', layer, pose: this.pose, data: {}, ...(parent ? { parent } : {}), ...(id ? { id } : {}), ...(this.index === undefined ? {} : { index: this.index }) });
  }
  toString(): string { return `Add(${this.group ? 'group' : 'mark'}, ${this.parent}, L${this.layer}, ${this.name === null ? 'fresh' : NAMES[this.name % NAMES.length]}, @${this.index})`; }
}

class Remove extends Edit {
  constructor(readonly k: number) { super(); }
  edit(s: S): void { const id = pick(nodeIds(s), this.k); if (id) s.remove(id); }
  toString(): string { return `Remove(${this.k})`; }
}

class Move extends Edit {
  constructor(readonly k: number, readonly to: number | null, readonly index: number | undefined) { super(); }
  edit(s: S): void {
    const id = pick(nodeIds(s), this.k);
    if (!id) return;
    const to = this.to === null ? null : pick(groups(s), this.to) ?? null;
    s.move(id, to, this.index);
  }
  toString(): string { return `Move(${this.k} → ${this.to}, @${this.index})`; }
}

class Reorder extends Edit {
  constructor(readonly k: number, readonly index: number) { super(); }
  edit(s: S): void { const id = pick(nodeIds(s), this.k); if (id) s.reorder(id, this.index); }
  toString(): string { return `Reorder(${this.k}, @${this.index})`; }
}

class SetPose extends Edit {
  constructor(readonly k: number, readonly pose: Pose) { super(); }
  edit(s: S): void { const id = pick(nodeIds(s), this.k); if (id) s.setPose(id, this.pose); }
  toString(): string { return `SetPose(${this.k}, ${JSON.stringify(this.pose)})`; }
}

class Flag extends Edit {
  constructor(readonly k: number, readonly which: 'hidden' | 'locked', readonly on: boolean) { super(); }
  edit(s: S): void {
    const id = pick(nodeIds(s), this.k);
    if (!id) return;
    if (this.which === 'hidden') s.setHidden(id, this.on);
    else s.setLocked(id, this.on);
  }
  toString(): string { return `Flag(${this.k}, ${this.which}, ${this.on})`; }
}

class SetLayer extends Edit {
  constructor(readonly k: number, readonly layer: number) { super(); }
  edit(s: S): void { const id = pick(nodeIds(s), this.k); if (id) s.setLayer(id, pick(layerIds(s), this.layer)!); }
  toString(): string { return `SetLayer(${this.k}, L${this.layer})`; }
}

class LayerEdit extends Edit {
  constructor(readonly what: 'add' | 'move' | 'rename' | 'remove', readonly name: number, readonly index: number) { super(); }
  edit(s: S): void {
    const ids = layerIds(s);
    const named = NAMES[this.name % NAMES.length]!;
    if (this.what === 'add') s.addLayer({ id: ids.includes(named) ? `${named}${ids.length}` : named, name: named, ...(Number.isFinite(this.index) ? { index: this.index } : {}) });
    else if (this.what === 'move') s.moveLayer(pick(ids, this.name)!, this.index);
    else if (this.what === 'rename') s.renameLayer(pick(ids, this.name)!, named);
    else s.removeLayer(pick(ids, this.name)!);
  }
  toString(): string { return `Layer(${this.what}, ${this.name}, @${this.index})`; }
}

class DocSet extends Edit {
  constructor(readonly key: number, readonly value: number | null) { super(); }
  edit(s: S): void { s.batch('doc', () => s.doc.set(NAMES[this.key % NAMES.length]!, this.value === null ? undefined : this.value)); }
  toString(): string { return `Doc(${NAMES[this.key % NAMES.length]}, ${this.value})`; }
}

class PageEdit extends Edit {
  constructor(readonly what: 'add' | 'remove' | 'move', readonly k: number, readonly named: boolean, readonly index: number) { super(); }
  edit(s: S): void {
    const pages = pagesOf(s)?.pages ?? [];
    if (this.what === 'add') {
      const name = NAMES[this.k % NAMES.length]!;
      const id = this.named && !pages.some((p) => p.id === name) ? name : nextPageId(pages);
      addPage(s, { id, width: 100 + this.k, height: 80 }, { index: this.index });
    } else if (this.what === 'remove') {
      const p = pick(pages, this.k);
      if (p) removePage(s, p.id);
    } else {
      const p = pick(pages, this.k);
      if (p) movePage(s, p.id, this.index);
    }
  }
  toString(): string { return `Page(${this.what}, ${this.k}, ${this.named}, @${this.index})`; }
}

class Undo implements fc.Command<Model, Real> {
  check(): boolean { return true; }
  run(m: Model, r: Real): void {
    const before = r.scene.historyIndex();
    r.scene.undo();
    if (before === 0) return;
    expect(r.scene.historyIndex()).toBe(before - 1);
    expect(json(r.scene), 'undo lands on the state before the entry').toEqual(m.states[before - 1]);
    checkTree(r.scene);
    t.count('Undo');
  }
  toString(): string { return 'Undo'; }
}

class Redo implements fc.Command<Model, Real> {
  check(): boolean { return true; }
  run(m: Model, r: Real): void {
    if (!r.scene.canRedo()) return;
    const before = r.scene.historyIndex();
    r.scene.redo();
    expect(json(r.scene), 'redo lands on the state the entry left').toEqual(m.states[before + 1]);
    checkTree(r.scene);
    t.count('Redo');
  }
  toString(): string { return 'Redo'; }
}

class Jump implements fc.Command<Model, Real> {
  constructor(readonly to: number) {}
  check(): boolean { return true; }
  run(m: Model, r: Real): void {
    const total = r.scene.historyEntries().length;
    const target = Math.max(0, Math.min(total, this.to));
    r.scene.jumpToHistoryIndex(this.to);
    expect(r.scene.historyIndex()).toBe(target);
    expect(json(r.scene), `a jump to ${this.to} lands on that entry's state`).toEqual(m.states[target]);
    checkTree(r.scene);
    t.count('Jump');
  }
  toString(): string { return `Jump(${this.to})`; }
}

/** The document and its history, read from their JSON text into a fresh scene that carries on in its place. */
class Reload implements fc.Command<Model, Real> {
  check(): boolean { return true; }
  run(m: Model, r: Real): void {
    const doc = json(r.scene);
    const history = JSON.parse(JSON.stringify(r.scene.serializeHistory()));
    const index = r.scene.historyIndex();
    const total = r.scene.historyEntries().length;
    checkFixedPoint(r.scene);
    const next = make();
    next.loadState(doc as never);
    next.restoreHistory(history);
    expect(json(next)).toEqual(doc);
    expect(next.historyIndex()).toBe(index);
    expect(next.historyEntries().length).toBe(total);
    r.scene = next;
    t.count('Reload');
  }
  toString(): string { return 'Reload'; }
}

const commands = fc.commands([
  fc.tuple(fc.boolean(), fc.option(fc.nat(), { nil: null }), fc.nat(), fc.option(fc.nat(), { nil: null, freq: 2 }), POSE, fc.option(INDEX, { nil: undefined }))
    .map(([g, p, l, n, pose, i]) => new Add(g, p, l, n, pose, i)),
  fc.nat().map((k) => new Remove(k)),
  fc.tuple(fc.nat(), fc.option(fc.nat(), { nil: null }), fc.option(INDEX, { nil: undefined })).map(([k, to, i]) => new Move(k, to, i)),
  fc.tuple(fc.nat(), INDEX).map(([k, i]) => new Reorder(k, i)),
  fc.tuple(fc.nat(), POSE).map(([k, p]) => new SetPose(k, p)),
  fc.tuple(fc.nat(), fc.constantFrom<'hidden' | 'locked'>('hidden', 'locked'), fc.boolean()).map(([k, w, on]) => new Flag(k, w, on)),
  fc.tuple(fc.nat(), fc.nat()).map(([k, l]) => new SetLayer(k, l)),
  fc.tuple(fc.constantFrom<'add' | 'move' | 'rename' | 'remove'>('add', 'move', 'rename', 'remove'), fc.nat(), INDEX).map(([w, n, i]) => new LayerEdit(w, n, i)),
  fc.tuple(fc.nat(), fc.option(fc.integer(), { nil: null })).map(([k, v]) => new DocSet(k, v)),
  fc.tuple(fc.constantFrom<'add' | 'remove' | 'move'>('add', 'remove', 'move'), fc.nat(), fc.boolean(), INDEX).map(([w, k, n, i]) => new PageEdit(w, k, n, i)),
  fc.constant(new Undo()),
  fc.constant(new Redo()),
  fc.integer({ min: -2, max: 40 }).map((to) => new Jump(to)),
  fc.constant(new Reload()),
], { maxCommands: 100, size: 'max' });

describe('a scene through long runs of edits, z-order, layers, pages, and history', () => {
  it('every step keeps the model, the tree, and the snapshot fixed point', () => {
    fc.assert(fc.property(commands, (cmds) => {
      const scene = make();
      fc.modelRun(() => ({ model: { states: [json(scene)] }, real: { scene } }), cmds);
      if ([...cmds].length >= 50) t.count('long');
    }), runs(N));
    t.atLeast('long', N / 4);
    for (const k of ['Add', 'Remove', 'Move', 'Reorder', 'SetPose', 'Flag', 'SetLayer', 'LayerEdit', 'DocSet', 'PageEdit', 'Undo', 'Redo', 'Jump', 'Reload']) t.atLeast(k, 5);
  }, T);
});
