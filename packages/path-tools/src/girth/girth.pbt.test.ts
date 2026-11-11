/**
 * Property tests of the Girth tool. Its actions, stateful on a real scene of stroked paths: drags on a stroke's edge,
 * committed or canceled, clicks that clear a width point, undo, and redo. After every step each path is well formed,
 * each width entry is unset or finite and not negative, a step was recorded exactly when the scene changed, and
 * undo, redo, and the last-operation replay land where the model says. And `anchorNormals`, which every width edit
 * measures along: unit length, and turning with the path.
 */
import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { anchorsToPath, pathToAnchors, type PolygonPath } from '@weasel-js/geom';
import { vertexHalfWidths, type Stroke } from '@weasel-js/paint';
import type { ImmediateInvoker, InvocationCtx, OngoingHandle, OngoingInvoker } from '@weasel-js/routing';
import { asNodeId, createScene, defaultCommitAdapter, IDENTITY_POSE_COMPOSITION, type Op, type Scene } from '@weasel-js/core';
import { createGirthActions, GIRTH_CLEAR_ID, GIRTH_DRAG_ID, type GirthFocus } from './girthActions';
import { anchorNormals } from './widthEdit';
import { checkPath, densePath, penPath, runs, snap, tally, timeoutFor } from '../pbt.fixture';

const VIEW = { get: () => ({ x: 0, y: 0, scale: { x: 1, y: 1 } }) };
type Data = { stroke: Stroke };

function sceneOf(strokes: readonly { path: PolygonPath; width: number }[]) {
  const scene = createScene<Data, 'main', PolygonPath>({ composition: IDENTITY_POSE_COMPOSITION, systemLayers: [{ id: 'main' }] });
  for (const [k, { path, width }] of strokes.entries()) {
    scene.add({ id: asNodeId(`s${k}`), kind: 'mark', layer: 'main', pose: path, data: { stroke: { paint: { kind: 'solid', color: '#000' }, width } } });
  }
  const loose = scene as unknown as Scene<unknown, string, unknown>;
  const applyOps = (ops: Op[], label = '') => { scene.applyBatch(ops, label, defaultCommitAdapter(loose)); };
  const deps = { scene: loose, applyOps, view: VIEW, selection: { get: () => [], set: () => {} } } as never;
  let focus: GirthFocus | null = null;
  const actions = createGirthActions({ focus: () => focus, setFocus: (f) => { focus = f; }, reachPx: () => 6 });
  return { scene, deps, actions };
}
type H = ReturnType<typeof sceneOf>;

const sceneSnap = (h: H) => JSON.stringify(h.scene.renderOrderNodes().map((n) => ({
  id: n.id, path: snap(n.pose as PolygonPath), stroke: (n.data as Data).stroke,
})));

function checkScene(h: H): void {
  for (const n of h.scene.renderOrderNodes()) {
    const path = n.pose as PolygonPath;
    checkPath(path);
    const widths = (n.data as Data).stroke.vertexWidths;
    if (!widths) continue;
    expect(widths.length, 'one width entry per anchor').toBe(pathToAnchors(path).anchors.flat().length);
    for (const w of widths) {
      const { left, right } = vertexHalfWidths(w, NaN);
      for (const side of [left, right]) {
        if (!Number.isNaN(side)) expect(Number.isFinite(side) && side >= 0, `width ${JSON.stringify(w)}`).toBe(true);
      }
    }
  }
}

interface Model { states: string[]; cursor: number; base: number }

const t = tally();

/** Check `act` recorded one step exactly when it changed the scene, and keep the model's history. */
function step(m: Model, h: H, id: string, act: () => void): boolean {
  const before = sceneSnap(h);
  act();
  const after = sceneSnap(h);
  checkScene(h);
  const changed = after !== before;
  const at = h.scene.historyIndex() - m.base;
  if (at === m.cursor + 1) {
    expect(changed, `${id} recorded a step that changed nothing`).toBe(true);
    m.states.splice(m.cursor + 1);
    m.states.push(after);
    m.cursor++;
  } else {
    expect(at, `${id} records one step or none`).toBe(m.cursor);
    expect(changed, `${id} changed the scene without recording it`).toBe(false);
  }
  t.count(`${id}:${changed ? 'ran' : 'idle'}`);
  return changed;
}

/** A point on stroke `k`'s edge: at anchor `i`, `side` of its normal, `off` past the edge. */
function edgePoint(h: H, k: number, i: number, side: 1 | -1, off: number): { x: number; y: number } {
  const nodes = h.scene.renderOrderNodes();
  const node = nodes[k % nodes.length]!;
  const path = node.pose as PolygonPath;
  const flat = pathToAnchors(path).anchors.flat();
  const j = i % flat.length;
  const n = anchorNormals(path)[j]!;
  const half = ((node.data as Data).stroke.width as number) / 2 + off;
  return { x: flat[j]!.x + side * n.x * half, y: flat[j]!.y + side * n.y * half };
}

const ctx = (h: H, world: { x: number; y: number }, start: { x: number; y: number }, alt: boolean): InvocationCtx => ({
  world, screen: world, modifiers: { alt, ctrl: false, meta: false, shift: false }, deps: h.deps,
  drag: { start, current: world, delta: { x: world.x - start.x, y: world.y - start.y } },
} as InvocationCtx);

class Drag implements fc.Command<Model, H> {
  constructor(readonly k: number, readonly i: number, readonly side: 1 | -1, readonly off: number, readonly moves: { d: number; alt: boolean }[],
    readonly params: Record<string, unknown>, readonly commit: boolean, readonly replay: boolean) {}
  check(): boolean { return true; }
  run(m: Model, h: H): void {
    const press = edgePoint(h, this.k, this.i, this.side, this.off);
    const action = h.actions.find((a) => a.id === GIRTH_DRAG_ID)!;
    let handle: OngoingHandle = {};
    const id = this.commit ? 'drag' : 'drag:cancel';
    const changed = step(m, h, id, () => {
      handle = (action.invoker as OngoingInvoker).start(ctx(h, press, press, false), { params: this.params });
      // Each move goes `d` along the press's own offset from the stroke, out or in.
      const nodes = h.scene.renderOrderNodes();
      const path = nodes[this.k % nodes.length]!.pose as PolygonPath;
      const j = this.i % pathToAnchors(path).anchors.flat().length;
      const n = anchorNormals(path)[j]!;
      for (const mv of this.moves) handle.onMove?.(ctx(h, { x: press.x + this.side * n.x * mv.d, y: press.y + this.side * n.y * mv.d }, press, mv.alt));
      handle.onEnd?.({ ...ctx(h, press, press, false), deps: {} as never }, this.commit ? 'commit' : 'cancel');
    });
    if (!this.commit) expect(changed, 'a canceled drag changes nothing').toBe(false);
    if (changed && this.replay && handle.replay) {
      const after = sceneSnap(h);
      h.scene.undo();
      handle.replay(this.params);
      expect(sceneSnap(h), 'replayed with its own params').toEqual(after);
      expect(h.scene.historyIndex() - m.base, 'a replay records one step').toBe(m.cursor);
      t.count('replay');
    }
  }
  toString(): string { return `Drag(${JSON.stringify([this.k, this.i, this.side, this.off, this.moves, this.params, this.commit, this.replay])})`; }
}

class Clear implements fc.Command<Model, H> {
  constructor(readonly k: number, readonly i: number, readonly side: 1 | -1, readonly off: number, readonly pressed: boolean) {}
  check(): boolean { return true; }
  run(m: Model, h: H): void {
    const press = edgePoint(h, this.k, this.i, this.side, this.off);
    const action = h.actions.find((a) => a.id === GIRTH_CLEAR_ID)!;
    const params = this.pressed ? { press } : undefined;
    const on = action.enabled ? action.enabled(h.deps, this.pressed ? press : undefined, undefined, params) === true : true;
    const changed = step(m, h, 'clear', () => { if (on) (action.invoker as ImmediateInvoker).run(h.deps, params); });
    // A click enables it outright; without one, `enabled` asks what the run would do.
    if (on && !this.pressed) expect(changed, 'girth.clear is enabled with no click and changed nothing').toBe(true);
  }
  toString(): string { return `Clear(${JSON.stringify([this.k, this.i, this.side, this.off, this.pressed])})`; }
}

class Undo implements fc.Command<Model, H> {
  check(m: Readonly<Model>): boolean { return m.cursor > 0; }
  run(m: Model, h: H): void {
    h.scene.undo();
    m.cursor--;
    expect(sceneSnap(h)).toEqual(m.states[m.cursor]);
    t.count('undo');
  }
  toString(): string { return 'Undo'; }
}

class Redo implements fc.Command<Model, H> {
  check(m: Readonly<Model>): boolean { return m.cursor < m.states.length - 1; }
  run(m: Model, h: H): void {
    h.scene.redo();
    m.cursor++;
    expect(sceneSnap(h)).toEqual(m.states[m.cursor]);
    t.count('redo');
  }
  toString(): string { return 'Redo'; }
}

const where = fc.tuple(fc.nat({ max: 3 }), fc.nat({ max: 16 }), fc.constantFrom<1 | -1>(1, -1), fc.constantFrom(0, 0, 0.5, -0.5, 3, 20));

const commands = fc.commands([
  fc.tuple(where, fc.array(fc.record({ d: fc.integer({ min: -30, max: 30 }), alt: fc.boolean() }), { maxLength: 4 }),
    fc.record({ oneSided: fc.boolean(), reach: fc.constantFrom(1, 6, 30) }, { requiredKeys: [] }), fc.constantFrom(true, true, true, false), fc.boolean())
    .map(([[k, i, s, o], moves, p, commit, replay]) => new Drag(k, i, s, o, moves, p, commit, replay)),
  fc.tuple(where, fc.constantFrom(true, true, false)).map(([[k, i, s, o], pressed]) => new Clear(k, i, s, o, pressed)),
  fc.constant(new Undo()),
  fc.constant(new Redo()),
], { maxCommands: 16, size: 'large' });

const strokes = fc.array(fc.record({ path: fc.oneof(penPath, densePath), width: fc.constantFrom(1, 4, 10, 25) }), { minLength: 1, maxLength: 3 });

describe('Girth actions on a real scene, stateful property', () => {
  it('keep paths and widths well formed, record a step exactly when they change the scene, and undo, redo, and replay exactly', () => {
    fc.assert(fc.property(strokes, commands, (ss, cmds) => {
      const h = sceneOf(ss);
      const model: Model = { states: [sceneSnap(h)], cursor: 0, base: h.scene.historyIndex() };
      fc.modelRun(() => ({ model, real: h }), cmds);
    }), runs(300));
    for (const k of ['drag:ran', 'replay', 'undo']) expect(t.get(k), `${k} ${t}`).toBeGreaterThan(20);
    expect(t.get('clear:ran'), `${t}`).toBeGreaterThan(5);
  }, timeoutFor(300, 200));
});

const rot90 = (p: { x: number; y: number }) => ({ x: -p.y, y: p.x });

describe('anchorNormals, property', () => {
  it('gives every anchor a finite unit normal, which turns and moves with the path', () => {
    fc.assert(fc.property(fc.oneof(penPath, densePath), fc.integer({ min: -50, max: 50 }), fc.integer({ min: -50, max: 50 }), (path, dx, dy) => {
      const normals = anchorNormals(path);
      const set = pathToAnchors(path);
      expect(normals.length).toBe(set.anchors.flat().length);
      for (const n of normals) expect(Math.abs(Math.hypot(n.x, n.y) - 1)).toBeLessThan(1e-9);
      // A quarter turn and a move by whole units are exact, so the normals come out exactly turned.
      const moved = anchorsToPath(set.anchors.map((sub) => sub.map((a) => {
        const f = (p: { x: number; y: number }) => { const r = rot90(p); return { x: r.x + dx, y: r.y + dy }; };
        return { ...f(a), ...(a.inHandle ? { inHandle: f(a.inHandle) } : {}), ...(a.outHandle ? { outHandle: f(a.outHandle) } : {}) };
      })), set.closed);
      const turned = anchorNormals(moved);
      normals.forEach((n, i) => {
        const r = rot90(n);
        // An anchor with no direction at all has no normal to turn; it takes the default.
        if (turned[i]!.x === 0 && turned[i]!.y === 1 && n.x === 0 && n.y === 1) { t.count('normals:none'); return; }
        expect(turned[i]!.x).toBeCloseTo(r.x, 6);
        expect(turned[i]!.y).toBeCloseTo(r.y, 6);
        t.count('normals:turned');
      });
    }), runs(300));
    expect(t.get('normals:turned'), `${t}`).toBeGreaterThan(100);
  }, timeoutFor(300, 5));

  it("at an open end, stands square to the curve's own tangent there, a retracted handle included", () => {
    fc.assert(fc.property(penPath, (path) => {
      const normals = anchorNormals(path);
      const set = pathToAnchors(path);
      let flat = 0;
      set.anchors.forEach((sub, s) => {
        if (!set.closed[s] && sub.length > 1) {
          for (const [i, j, handle, far] of [[0, 1, 'outHandle', 'inHandle'], [sub.length - 1, sub.length - 2, 'inHandle', 'outHandle']] as const) {
            const a = sub[i]!;
            const b = sub[j]!;
            // The cubic's tangent at its end: toward its own control point, else the far one, else the far end.
            const dir = [a[handle], b[far], b].map((p) => p && { x: p.x - a.x, y: p.y - a.y }).find((d) => d && Math.hypot(d.x, d.y) > 0);
            if (!dir) continue;
            const n = normals[flat + i]!;
            expect(Math.abs(n.x * dir.x + n.y * dir.y) / Math.hypot(dir.x, dir.y), `anchor ${flat + i}`).toBeLessThan(1e-6);
            t.count(`normals:end:${a[handle] && Math.hypot(a[handle]!.x - a.x, a[handle]!.y - a.y) === 0 ? 'retracted' : 'handled'}`);
          }
        }
        flat += sub.length;
      });
    }), runs(300));
    expect(t.get('normals:end:retracted'), `${t}`).toBeGreaterThan(5);
  }, timeoutFor(300, 5));
});
