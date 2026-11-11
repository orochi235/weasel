/**
 * Stateful property test of the HUD layer's deps: random edits to widgets (shown, hidden, moved, their deps bumped
 * to an equal or a different array, a `content` painter or no deps declared), adds, removes, focus moves, and canvas
 * resizes, with a frame taken now and then. Each frame's deps must be the last frame's array exactly when every
 * widget would draw what it drew then.
 */
import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { createHud, type Hud } from './hud';
import { createLayerDeps } from './layerDeps';
import { runs, tally, timeoutFor } from './pbt.fixture';
import type { HudDrawCtx, Widget, WidgetBounds } from './widget';

const RUNS = 200;
const POOL = 4;

interface Fake extends Widget {
  hidden: boolean;
  bounds: WidgetBounds;
  values: unknown[] | null;
  painter: boolean;
}

/** What a frame is judged against: everything the layer's deps are documented to follow. */
interface Seen { list: number[]; hidden: boolean[]; bounds: number[]; deps: (unknown[] | undefined)[]; focused: number | null; visible: boolean; w: number; h: number }
interface Model { dims: { w: number; h: number }; last: Seen | null }
interface Real { hud: Hud; pool: Fake[]; deps: (ctx: HudDrawCtx) => readonly unknown[]; held: readonly unknown[] | null }

const hits = tally();

function fakes(): Fake[] {
  return Array.from({ length: POOL }, (_, i) => {
    const w: Fake = {
      id: `w${i}`, hidden: false, bounds: { x: 0, y: 0, w: 10, h: 10 }, values: [0], painter: false, focusable: true,
      draw: () => [], hitTest: () => false, onPointer: () => {}, dispose: () => {},
    };
    Object.defineProperty(w, 'deps', { get: () => (w.values ? () => w.values! : undefined) });
    Object.defineProperty(w, 'content', { get: () => (w.painter ? () => [] : undefined) });
    return w;
  });
}

function snapshot(m: Model, r: Real): Seen {
  const list = r.hud.widgets().map((w) => r.pool.indexOf(w as Fake));
  return {
    list,
    hidden: list.map((i) => r.pool[i]!.hidden),
    bounds: list.flatMap((i) => { const b = r.pool[i]!.bounds; return [b.x, b.y, b.w, b.h]; }),
    deps: list.map((i) => (r.pool[i]!.hidden ? undefined : r.pool[i]!.values ?? undefined)),
    focused: r.hud.focused ? r.pool.indexOf(r.hud.focused as Fake) : null,
    visible: r.hud.focusVisible,
    w: m.dims.w, h: m.dims.h,
  };
}

const sameDeps = (a: unknown[] | undefined, b: unknown[] | undefined) =>
  a === b || (!!a && !!b && a.length === b.length && a.every((v, i) => Object.is(v, b[i])));
function unchanged(a: Seen, b: Seen): boolean {
  return a.list.length === b.list.length && a.list.every((v, i) => v === b.list[i])
    && a.hidden.every((v, i) => v === b.hidden[i]) && a.bounds.every((v, i) => v === b.bounds[i])
    && a.deps.every((d, i) => sameDeps(d, b.deps[i]))
    && a.focused === b.focused && a.visible === b.visible && a.w === b.w && a.h === b.h;
}

type Cmd = fc.Command<Model, Real>;
const cmd = (name: string, run: (m: Model, r: Real) => void): Cmd => ({ check: () => true, run, toString: () => name });
const pick = fc.nat({ max: POOL - 1 });

const frame = fc.constant(cmd('frame', (m, r) => {
  const now = snapshot(m, r);
  const live = now.list.some((i) => !r.pool[i]!.hidden && (!r.pool[i]!.values || r.pool[i]!.painter));
  const held = r.deps({ dims: { width: m.dims.w, height: m.dims.h } } as HudDrawCtx);
  const same = m.last !== null && !live && unchanged(m.last, now);
  if (r.held !== null) {
    expect(held === r.held).toBe(same);
    hits.hit(same ? 'held' : live ? 'live' : 'moved');
  }
  m.last = now;
  r.held = held;
}));

const hide = fc.tuple(pick, fc.boolean()).map(([i, h]) => cmd(`hide ${i} ${h}`, (_m, r) => { r.pool[i]!.hidden = h; }));
const moveTo = fc.tuple(pick, fc.constantFrom(0, -0, 5, 10), fc.constantFrom(0, 10, 10.5)).map(([i, x, w]) => cmd(`bounds ${i} ${x} ${w}`, (_m, r) => {
  r.pool[i]!.bounds = { x, y: 0, w, h: 10 };
}));
const bump = fc.tuple(pick, fc.constantFrom('same', 'equal', 'other', 'nan', 'none')).map(([i, how]) => cmd(`deps ${i} ${how}`, (_m, r) => {
  const w = r.pool[i]!;
  const v = w.values;
  if (how === 'equal' && v) w.values = [...v];
  else if (how === 'other') w.values = [(v?.[0] as number ?? 0) + 1];
  else if (how === 'nan') w.values = [NaN];
  else if (how === 'none') w.values = w.values ? null : [0];
}));
const paint = fc.tuple(pick, fc.boolean()).map(([i, on]) => cmd(`content ${i} ${on}`, (_m, r) => { r.pool[i]!.painter = on; }));
const add = pick.map((i) => cmd(`add ${i}`, (_m, r) => { r.hud.add(r.pool[i]!); }));
const remove = pick.map((i) => cmd(`remove ${i}`, (_m, r) => { r.hud.remove(r.pool[i]!); }));
const focus = fc.tuple(fc.option(pick, { nil: null }), fc.boolean()).map(([i, visible]) => cmd(`focus ${i} ${visible}`, (_m, r) => {
  r.hud.focus(i === null ? null : r.pool[i]!, { visible });
}));
const resize = fc.tuple(fc.constantFrom(300, 400), fc.constantFrom(200, 300)).map(([w, h]) => cmd(`resize ${w}x${h}`, (m) => { m.dims = { w, h }; }));

describe('createLayerDeps (stateful)', () => {
  it('holds its array exactly while every widget would draw what it drew last frame', () => {
    fc.assert(fc.property(fc.commands([frame, frame, frame, hide, moveTo, bump, bump, paint, add, add, remove, focus, resize], { maxCommands: 60, size: 'large' }), (cmds) => {
      const pool = fakes();
      const hud = createHud();
      const r: Real = { hud, pool, deps: createLayerDeps(hud), held: null };
      fc.modelRun(() => ({ model: { dims: { w: 400, h: 300 }, last: null }, real: r }), cmds);
    }), runs(RUNS));
    for (const k of ['held', 'moved', 'live']) hits.atLeast(k, 30);
  }, timeoutFor(RUNS, 20));
});
