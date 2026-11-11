/**
 * Stateful property test of the commands that act on a scene's strokes from outside path edit, on a real scene of
 * random paths: Extend to next path, Trim segment, and the Smudge brush, with node selections, undo, and redo at
 * random. After every step each stroke is well formed and finite; a command changed the scene exactly when it was
 * enabled and recorded one undo step; and undo and redo land on the scenes the model recorded.
 */
import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { pathToAnchors, type PolygonPath } from '@weasel-js/geom';
import type { Action, ImmediateInvoker, InvocationCtx, OngoingInvoker } from '@weasel-js/routing';
import { asNodeId, createScene, defaultCommitAdapter, IDENTITY_POSE_COMPOSITION, type NodeId, type Op, type Scene } from '@weasel-js/core';
import { extendToMeetAction, smudgeBrushAction, trimPathAction } from './index';
import { checkPath, densePath, penPath, point, runs, snap, tally, timeoutFor } from './pbt.fixture';

const VIEW = { get: () => ({ x: 0, y: 0, scale: { x: 1, y: 1 } }) };

function sceneOf(paths: readonly PolygonPath[]) {
  const scene = createScene<Record<string, never>, 'main', PolygonPath>({ composition: IDENTITY_POSE_COMPOSITION, systemLayers: [{ id: 'main' }] });
  for (const [k, pose] of paths.entries()) scene.add({ id: asNodeId(`p${k}`), kind: 'mark', layer: 'main', pose, data: {} });
  const loose = scene as unknown as Scene<unknown, string, unknown>;
  const applyOps = (ops: Op[], label = '') => { scene.applyBatch(ops, label, defaultCommitAdapter(loose)); };
  const selection = { get: () => scene.getSelection(), set: (ids: readonly string[]) => scene.setSelection(ids.map(asNodeId)) };
  const deps = { scene: loose, selection, applyOps, view: VIEW, history: scene.history, notices: { warn: () => {} } } as never;
  return { scene, deps, ids: paths.map((_, k) => `p${k}`) };
}
type H = ReturnType<typeof sceneOf>;

/** The scene as it compares: each stroke in render order. */
const sceneSnap = (h: H) => JSON.stringify(h.scene.renderOrderNodes().map((n) => ({ id: n.id, path: snap(n.pose as PolygonPath) })));

interface Model { states: string[]; cursor: number; base: number }

const t = tally();

/** Run `act` on the scene, then check it changed the scene exactly when it was `enabled` and recorded one step. */
function step(m: Model, h: H, id: string, enabled: boolean, act: () => void, opts: { idleOk?: boolean } = {}): void {
  const before = sceneSnap(h);
  act();
  const after = sceneSnap(h);
  for (const n of h.scene.renderOrderNodes()) checkPath(n.pose as PolygonPath);
  const changed = after !== before;
  if (!enabled) expect(changed, `${id} is disabled and still changed the scene`).toBe(false);
  else if (!opts.idleOk) expect(changed, `${id} is enabled and changed nothing`).toBe(true);
  t.count(`${id}:${enabled ? (changed ? 'ran' : 'idle') : 'off'}`);
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
}

const isOn = (a: Action, deps: never, at?: { x: number; y: number }, params?: Record<string, unknown>) =>
  (a.enabled ? a.enabled(deps, at, undefined, params) : true) === true;

/** Extend the selected strokes' open ends, or, given a press, the end nearest it. */
class Extend implements fc.Command<Model, H> {
  constructor(readonly params: Record<string, unknown>, readonly press: { x: number; y: number } | null) {}
  check(): boolean { return true; }
  run(m: Model, h: H): void {
    const params = this.press ? { ...this.params, press: this.press } : this.params;
    // A click's point enables it outright, and the run decides; without one, `enabled` asks what `run` would do.
    const on = this.press ? isOn(extendToMeetAction, h.deps, this.press, this.params) : isOn(extendToMeetAction, h.deps, undefined, params);
    step(m, h, 'extendToMeet', on, () => { if (on) (extendToMeetAction.invoker as ImmediateInvoker).run(h.deps, params); }, { idleOk: !!this.press });
  }
  toString(): string { return `Extend(${JSON.stringify(this.params)} ${JSON.stringify(this.press)})`; }
}

/** A trim click at `press`, or the command with no click at all. */
class Trim implements fc.Command<Model, H> {
  constructor(readonly press: { x: number; y: number } | null, readonly radiusPx: number) {}
  check(): boolean { return true; }
  run(m: Model, h: H): void {
    const binding = { radiusPx: this.radiusPx };
    const on = isOn(trimPathAction, h.deps, this.press ?? undefined, binding);
    const params = this.press ? { ...binding, press: this.press } : binding;
    step(m, h, 'trimPath', on, () => { if (on) (trimPathAction.invoker as ImmediateInvoker).run(h.deps, params); }, { idleOk: !!this.press });
  }
  toString(): string { return `Trim(${JSON.stringify(this.press)} ${this.radiusPx})`; }
}

/** A smudge stroke from `from` through `moves`, committed or canceled. */
class Smudge implements fc.Command<Model, H> {
  constructor(readonly from: { x: number; y: number }, readonly moves: { x: number; y: number }[], readonly params: Record<string, unknown>, readonly commit: boolean) {}
  check(): boolean { return true; }
  run(m: Model, h: H): void {
    const on = isOn(smudgeBrushAction, h.deps);
    const ctx = (world: { x: number; y: number }) => ({
      deps: h.deps, world, modifiers: { alt: false, ctrl: false, meta: false, shift: false },
      drag: { start: this.from, current: world, delta: { x: world.x - this.from.x, y: world.y - this.from.y } },
    }) as unknown as InvocationCtx;
    step(m, h, `smudgeBrush${this.commit ? '' : ':cancel'}`, on, () => {
      if (!on) return;
      const handle = (smudgeBrushAction.invoker as OngoingInvoker).start(ctx(this.from), { params: this.params });
      for (const to of this.moves) handle.onMove?.(ctx(to));
      handle.onEnd?.(ctx(this.moves.at(-1) ?? this.from), this.commit ? 'commit' : 'cancel');
      if (!this.commit) t.count('smudge:canceled');
    }, { idleOk: true });
    if (!this.commit) expect(h.scene.historyIndex() - m.base, 'a canceled smudge records nothing').toBe(m.cursor);
  }
  toString(): string { return `Smudge(${JSON.stringify([this.from, this.moves, this.params, this.commit])})`; }
}

class Select implements fc.Command<Model, H> {
  constructor(readonly picks: number[]) {}
  check(): boolean { return true; }
  run(m: Model, h: H): void {
    const ids = h.scene.renderOrderNodes().map((n) => n.id);
    h.scene.setSelection([...new Set(this.picks.map((k) => ids[k % Math.max(1, ids.length)]).filter(Boolean))] as NodeId[]);
    expect(h.scene.historyIndex() - m.base, 'a selection is no undo step').toBe(m.cursor);
  }
  toString(): string { return `Select(${this.picks.join(',')})`; }
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

const extendParams = fc.record({ shape: fc.constantFrom('eased', 'straight'), easeTurn: fc.constantFrom(0.2, 0.5, 1.2) }, { requiredKeys: [] });

const commands = fc.commands([
  fc.tuple(extendParams, fc.option(point, { nil: null })).map(([p, at]) => new Extend(p, at)),
  fc.tuple(fc.option(point, { freq: 8, nil: null }), fc.integer({ min: 1, max: 30 })).map(([at, r]) => new Trim(at, r)),
  fc.tuple(point, fc.array(point, { maxLength: 4 }), fc.record({ radiusPx: fc.integer({ min: 2, max: 120 }), strength: fc.constantFrom(0.05, 0.6, 1) }, { requiredKeys: [] }), fc.constantFrom(true, true, false))
    .map(([from, moves, p, commit]) => new Smudge(from, moves, p, commit)),
  fc.array(fc.nat({ max: 8 }), { maxLength: 3 }).map((ks) => new Select(ks)),
  fc.array(fc.nat({ max: 8 }), { maxLength: 3 }).map((ks) => new Select(ks)),
  fc.constant(new Undo()),
  fc.constant(new Redo()),
], { maxCommands: 20, size: 'large' });

/** Two to four strokes, open ones among them so extend has ends to carry. */
const strokes = fc.array(fc.oneof(penPath, penPath, densePath), { minLength: 2, maxLength: 4 })
  .filter((ps) => ps.some((p) => pathToAnchors(p).closed.some((c) => !c)));

describe('scene stroke commands on a real scene, stateful property', () => {
  it('keep every stroke well formed, run exactly when enabled, and undo and redo exactly', () => {
    fc.assert(fc.property(strokes, commands, (ps, cmds) => {
      const h = sceneOf(ps);
      const model: Model = { states: [sceneSnap(h)], cursor: 0, base: h.scene.historyIndex() };
      fc.modelRun(() => ({ model, real: h }), cmds);
    }), runs(200));
    for (const k of ['extendToMeet:ran', 'trimPath:ran', 'smudgeBrush:ran', 'undo', 'redo']) {
      expect(t.get(k), `${k} ${t}`).toBeGreaterThan(8);
    }
  }, timeoutFor(200, 200));
});
