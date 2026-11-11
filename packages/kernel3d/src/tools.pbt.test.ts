/**
 * The camera actions through long runs of gestures, stateful: orbit, pan, and pinch drags of many moves, with wheel
 * dollies, homes (one camera, set again and again), and cameras set from outside landing between them, against a
 * host whose camera lands at once and one whose camera lands only on its next render. After every move the gesture
 * has written its step of the camera it began on, rebased onto any camera another writer set that the host has shown
 * it, and a gesture nothing else wrote during ends where one move to its last input would have put it.
 */
import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import type { ActionDeps, ImmediateInvoker, InvocationCtx, OngoingInvoker } from '@weasel-js/core';
import { createCamera, dollyToward, orbitBy, panBy, type Camera3d } from './camera';
import type { Camera3dDep } from './cameraDep';
import { camera, runs, tally, timeoutFor } from './pbt.fixture';
import { DOLLY_RATE, ORBIT_RATE, dollyAction, homeAction, orbitAction, panAction, pinchDollyAction } from './tools';

const RUNS = 150;
const T = timeoutFor(RUNS, 20);
const PANE = { width: 800, height: 600 };
const NO_MODS = { alt: false, ctrl: false, meta: false, shift: false };

type Kind = 'orbit' | 'pan' | 'pinch';
type Cmd =
  | { t: 'start'; kind: Kind; spread: number; at: { x: number; y: number } }
  | { t: 'move'; x: number; y: number; spread: number }
  | { t: 'wheel'; deltaY: number; x: number; y: number }
  | { t: 'home' }
  | { t: 'set'; camera: Camera3d }
  | { t: 'render' }
  | { t: 'end' };

const d = fc.double({ min: -600, max: 600, noNaN: true });
const spread = fc.double({ min: 10, max: 400, noNaN: true });
const point = fc.record({ x: fc.double({ min: 0, max: 800, noNaN: true }), y: fc.double({ min: 0, max: 600, noNaN: true }) });
const cmd: fc.Arbitrary<Cmd> = fc.oneof(
  { weight: 2, arbitrary: fc.record({ t: fc.constant('start' as const), kind: fc.constantFrom<Kind>('orbit', 'pan', 'pinch'), spread, at: point }) },
  { weight: 8, arbitrary: fc.record({ t: fc.constant('move' as const), x: d, y: d, spread }) },
  { weight: 2, arbitrary: fc.record({ t: fc.constant('wheel' as const), deltaY: fc.double({ min: -300, max: 300, noNaN: true }), x: point.map((p) => p.x), y: point.map((p) => p.y) }) },
  { weight: 1, arbitrary: fc.constant({ t: 'home' as const }) },
  { weight: 2, arbitrary: camera.map((c) => ({ t: 'set' as const, camera: c })) },
  { weight: 3, arbitrary: fc.constant({ t: 'render' as const }) },
  { weight: 1, arbitrary: fc.constant({ t: 'end' as const }) },
);

/** A host's camera: `lagging`, a `set` lands only on the next render, the last one set winning. */
function hostOf(start: Camera3d, lagging: boolean, home: Camera3d) {
  let shown = start;
  let pending = start;
  const dep: Camera3dDep = {
    get: () => shown,
    set: (c) => { pending = c; if (!lagging) shown = c; },
    size: () => PANE,
    home: () => home,
  };
  return { dep, render: () => { shown = pending; }, last: () => pending };
}

/** What the gesture in hand should write: its step of the camera it rebased onto last, from the input it had reached then. */
interface Model {
  kind: Kind;
  origin: Camera3d;
  from: { x: number; y: number } | number;
  reached: { x: number; y: number } | number;
  start: Camera3d;
  /** The cameras this gesture wrote. The one it began on is not among them: another writer may set it again. */
  mine: Set<Camera3d>;
  /** What the host showed at the previous move, or at the start. */
  shown: Camera3d;
  at: { x: number; y: number };
  startSpread: number;
  touched: boolean;
  /** Whether another writer set the camera since the last move. */
  outside: boolean;
}

function stepOf(m: Model, input: { x: number; y: number } | number): Camera3d {
  if (m.kind === 'pinch') return dollyToward(m.origin, (input as number) / (m.from as number), m.at, PANE);
  const p = input as { x: number; y: number };
  const f = m.from as { x: number; y: number };
  const dx = p.x - f.x, dy = p.y - f.y;
  return m.kind === 'orbit' ? orbitBy(m.origin, -dx * ORBIT_RATE, dy * ORBIT_RATE) : panBy(m.origin, dx, dy, PANE.height);
}

type Handle = { onMove?(m: InvocationCtx): void };

const ctxOf = (deps: ActionDeps, more: Partial<InvocationCtx> = {}) =>
  ({ world: { x: 0, y: 0 }, screen: { x: 0, y: 0 }, modifiers: NO_MODS, deps, ...more }) as InvocationCtx;

describe('the camera actions through long runs of gestures, stateful', () => {
  it('write each move\'s step of the camera they began on or rebased onto, against a model', () => {
    const seen = tally();
    fc.assert(fc.property(camera, camera, fc.boolean(), fc.array(cmd, { minLength: 10, maxLength: 80 }), (c0, homeCam, lagging, cmds) => {
      const host = hostOf(c0, lagging, homeCam);
      const deps = { camera3d: host.dep } as unknown as ActionDeps;
      let handle: Handle | null = null;
      let m: Model | null = null;
      for (const c of cmds) {
        if (c.t === 'start') {
          const action = c.kind === 'orbit' ? orbitAction : c.kind === 'pan' ? panAction : pinchDollyAction;
          const start = host.dep.get();
          handle = (action.invoker as OngoingInvoker).start(ctxOf(deps, c.kind === 'pinch' ? { multiTouch: { spread: c.spread, centroid: c.at } } as Partial<InvocationCtx> : {})) as unknown as Handle;
          const zero = c.kind === 'pinch' ? 1 : { x: 0, y: 0 };
          m = { kind: c.kind, origin: start, from: zero, reached: zero, start, mine: new Set(), shown: start, at: c.at, startSpread: c.spread, touched: false, outside: false };
          seen.count(`start ${c.kind}`);
        } else if (c.t === 'move' && handle && m) {
          const now = host.dep.get();
          const input = m.kind === 'pinch' ? m.startSpread / c.spread : { x: c.x, y: c.y };
          // A host that shows every set at once was written by another since the last move exactly when it says so;
          // one that lags can only be read by what it shows: a camera this gesture did not write and it had not
          // shown at the last move.
          if (lagging ? !m.mine.has(now) && now !== m.shown : m.outside) {
            m.origin = now;
            m.from = m.reached;
            m.touched = true;
            seen.count('rebased');
          }
          m.shown = now;
          m.outside = false;
          handle.onMove!(ctxOf(deps, m.kind === 'pinch'
            ? { multiTouch: { pinch: { currentSpread: c.spread } } } as Partial<InvocationCtx>
            : { drag: { screenDelta: { x: c.x, y: c.y } } } as Partial<InvocationCtx>));
          const want = stepOf(m, input);
          expect(host.last()).toEqual(want);
          m.mine.add(host.last());
          m.reached = input;
          if (!m.touched) {
            // Nothing else wrote: one move straight to this input, from the camera it began on, lands the same.
            const fresh = hostOf(m.start, false, homeCam);
            const freshDeps = { camera3d: fresh.dep } as unknown as ActionDeps;
            const action = m.kind === 'orbit' ? orbitAction : m.kind === 'pan' ? panAction : pinchDollyAction;
            const one = (action.invoker as OngoingInvoker).start(ctxOf(freshDeps, m.kind === 'pinch' ? { multiTouch: { spread: m.startSpread, centroid: m.at } } as Partial<InvocationCtx> : {})) as { onMove(m: InvocationCtx): void };
            one.onMove(ctxOf(freshDeps, m.kind === 'pinch'
              ? { multiTouch: { pinch: { currentSpread: c.spread } } } as Partial<InvocationCtx>
              : { drag: { screenDelta: { x: c.x, y: c.y } } } as Partial<InvocationCtx>));
            expect(fresh.last()).toEqual(host.last());
            seen.count('untouched move');
          }
        } else if (c.t === 'wheel') {
          if ((dollyAction.invoker as ImmediateInvoker).run(deps, { deltaY: c.deltaY, clientX: c.x, clientY: c.y }) !== 'pass' && m) m.outside = true;
        } else if (c.t === 'home') {
          (homeAction.invoker as ImmediateInvoker).run(deps);
          if (m) m.outside = true;
        } else if (c.t === 'set') {
          host.dep.set(c.camera);
          if (m) m.outside = true;
        } else if (c.t === 'render') {
          host.render();
        } else if (c.t === 'end') {
          handle = null;
          m = null;
        }
      }
    }), runs(RUNS));
    for (const k of ['start orbit', 'start pan', 'start pinch', 'rebased', 'untouched move']) seen.atLeast(k, 20);
  }, T);

  it('dolly by the wheel about the point under it, at the rate asked for', () => {
    fc.assert(fc.property(camera, fc.double({ min: -300, max: 300, noNaN: true }), point, (c0, deltaY, at) => {
      const host = hostOf(c0, false, createCamera({}));
      const out = (dollyAction.invoker as ImmediateInvoker).run({ camera3d: host.dep } as unknown as ActionDeps, { deltaY, clientX: at.x, clientY: at.y });
      const factor = Math.exp(deltaY * DOLLY_RATE);
      if (factor === 1) {
        expect(out).toBe('pass');
        return;
      }
      expect(host.last()).toEqual(dollyToward(c0, factor, at, PANE));
    }), runs(RUNS));
  }, T);
});

