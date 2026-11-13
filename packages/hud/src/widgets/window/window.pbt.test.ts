/**
 * Stateful property tests of a HUD window: presses, moves, releases, cancels, `setBounds`, draws at any canvas size,
 * and hides, interleaved, against a model of its drag. Every step checks the bounds, the frame's revision, and what
 * `onMove`, `onResize`, `onClose`, and `onContentClick` heard. A drag also has to come out the same when the window
 * and every point move together.
 */
import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { resolveTheme, weaselTheme } from '@weasel-js/theme';
import { runs, tally, timeoutFor } from '../../pbt.fixture';
import type { WidgetBounds } from '../../widget';
import { createWindow } from './window';
import { applyWindowDrag, DEFAULT_WINDOW_METRICS, zoneAt, type WindowMetrics, type WindowZone } from './zones';

const RUNS = 200;
const tokens = resolveTheme(weaselTheme, { mode: 'dark' });
const drawCtx = (width: number, height: number) => ({ dims: { width, height }, defaultFont: 'D', color: () => '#000000', tokens });

type Cmd =
  | { t: 'down' | 'move' | 'up'; x: number; y: number }
  | { t: 'cancel' }
  | { t: 'bounds'; b: WidgetBounds }
  | { t: 'draw'; width: number; height: number }
  | { t: 'hide'; hidden: boolean };

const pt = fc.integer({ min: -40, max: 640 });
const rectArb = fc.record({ x: pt, y: pt, w: fc.integer({ min: 1, max: 400 }), h: fc.integer({ min: 1, max: 300 }) });
/** A point inside `b`, from its left or right edge, often in its frame, where the zones are thin. */
const near = fc.record({ right: fc.boolean(), fx: fc.oneof({ arbitrary: fc.integer({ min: -3, max: 24 }), weight: 2 }, fc.integer({ min: 0, max: 400 })), fy: fc.oneof({ arbitrary: fc.integer({ min: -3, max: 30 }), weight: 2 }, fc.integer({ min: 0, max: 300 })) });

/** A pointer's travel from its press: often under the drag threshold, or none at all. */
const delta = fc.oneof(fc.constant(0), fc.integer({ min: -4, max: 4 }), fc.integer({ min: -300, max: 300 }));

/** True three times in four: most presses land on the window, and most releases near their press. */
const mostly = fc.oneof(fc.constant(true), fc.constant(true), fc.constant(true), fc.constant(false));

const cmdsFor = fc.array(fc.oneof(
  { arbitrary: fc.record({ t: fc.constant('down' as const), at: near, x: pt, y: pt, rel: mostly }), weight: 3 },
  { arbitrary: fc.record({ t: fc.constantFrom('move' as const, 'up' as const), x: pt, y: pt, rel: mostly, dx: delta, dy: delta }), weight: 5 },
  { arbitrary: fc.record({ t: fc.constant('cancel' as const) }), weight: 1 },
  { arbitrary: fc.record({ t: fc.constant('bounds' as const), b: rectArb }), weight: 1 },
  { arbitrary: fc.record({ t: fc.constant('draw' as const), width: fc.integer({ min: 0, max: 900 }), height: fc.integer({ min: 0, max: 700 }) }), weight: 1 },
  { arbitrary: fc.record({ t: fc.constant('hide' as const), hidden: fc.boolean() }), weight: 1 },
), { maxLength: 50, size: 'max' });

const config = fc.record({
  titlebar: fc.boolean(),
  interior: fc.constantFrom('claim' as const, 'pass' as const),
  minW: fc.option(fc.integer({ min: 0, max: 200 }), { nil: undefined }),
  minH: fc.option(fc.integer({ min: 0, max: 200 }), { nil: undefined }),
  start: rectArb,
});
type Config = typeof config extends fc.Arbitrary<infer T> ? T : never;

interface Model {
  b: WidgetBounds;
  drag: WindowZone | null;
  press: WindowZone | null;
  start: WidgetBounds;
  origin: { x: number; y: number };
  moved: boolean;
  dims: { width: number; height: number } | null;
  heard: string[];
}

/** The metrics a window built from `c` lays itself out in. */
function metricsOf(c: Config): WindowMetrics {
  const m = DEFAULT_WINDOW_METRICS;
  if (c.titlebar) return m;
  return { ...m, titleH: c.interior === 'pass' ? m.grip : m.edge };
}

function modelOf(c: Config) {
  const m = metricsOf(c);
  const minW = c.minW ?? 80;
  const minH = c.minH ?? m.titleH + m.edge + 40;
  const sized = (b: WidgetBounds) => ({ ...b, w: Math.max(minW, b.w), h: Math.max(minH, b.h) });
  const clamp = (s: Model, b: WidgetBounds) => (s.dims
    ? { ...b, x: Math.max(0, Math.min(b.x, s.dims.width - b.w)), y: Math.max(0, Math.min(b.y, s.dims.height - b.h)) }
    : b);
  const asDrag = (z: WindowZone | null): WindowZone | null => {
    if (c.titlebar) return z;
    if (z === 'close') return 'title';
    return c.interior !== 'pass' && z === 'content' ? 'title' : z;
  };
  const same = (a: WidgetBounds, b: WidgetBounds) => a.x === b.x && a.y === b.y && a.w === b.w && a.h === b.h;
  const report = (s: Model) => { s.heard.push(`${s.drag === 'title' ? 'move' : 'resize'} ${s.b.x},${s.b.y},${s.b.w},${s.b.h}`); };

  const init = (): Model => {
    const b = sized(c.start);
    return { b, drag: null, press: null, start: b, origin: { x: 0, y: 0 }, moved: false, dims: null, heard: [] };
  };

  /** Applies `cmd`; whether the frame changed. */
  const step = (s: Model, cmd: Cmd): boolean => {
    switch (cmd.t) {
      case 'down':
        s.press = zoneAt(s.b, m, cmd.x, cmd.y);
        s.moved = false; s.drag = asDrag(s.press); s.start = s.b; s.origin = { x: cmd.x, y: cmd.y };
        return false;
      case 'move': {
        if (!s.drag) return false;
        s.moved = true;
        const dragged = applyWindowDrag(s.start, s.drag, cmd.x - s.origin.x, cmd.y - s.origin.y, minW, minH);
        const next = s.drag === 'title' ? clamp(s, dragged) : dragged;
        if (same(next, s.b)) return false;
        s.b = next; report(s);
        return true;
      }
      case 'up':
        if (s.drag === 'close' && zoneAt(s.b, m, cmd.x, cmd.y) === 'close') s.heard.push('close');
        else if (s.press === 'content' && !s.moved) s.heard.push(`click ${cmd.x},${cmd.y}`);
        s.drag = null; s.press = null;
        return false;
      case 'cancel': {
        // A cancel puts back where the drag began, and reports it only when that is somewhere else.
        const back = s.drag !== null && !same(s.b, s.start);
        if (back) { s.b = s.start; report(s); }
        s.drag = null; s.press = null;
        return back;
      }
      case 'bounds':
        s.b = clamp(s, sized(cmd.b)); s.drag = null; s.press = null;
        return true;
      case 'draw':
        s.dims = { width: cmd.width, height: cmd.height };
        return false;
      case 'hide':
        return true;
    }
  };
  return { init, step };
}

type Raw =
  | { t: 'down'; at: { right: boolean; fx: number; fy: number }; x: number; y: number; rel: boolean }
  | { t: 'move' | 'up'; x: number; y: number; rel: boolean; dx: number; dy: number }
  | Exclude<Cmd, { t: 'down' | 'move' | 'up' }>;

/** `raw` made concrete against the model: a press placed in the window's frame or anywhere, a move or release
 *  some way from the press or anywhere. */
function concrete(s: Model, raw: Raw): Cmd {
  if (raw.t === 'down') return raw.rel ? { t: 'down', x: raw.at.right ? s.b.x + s.b.w - 1 - raw.at.fx : s.b.x + raw.at.fx, y: s.b.y + raw.at.fy } : { t: 'down', x: raw.x, y: raw.y };
  if (raw.t === 'move' || raw.t === 'up') return raw.rel ? { t: raw.t, x: s.origin.x + raw.dx, y: s.origin.y + raw.dy } : { t: raw.t, x: raw.x, y: raw.y };
  return raw;
}

function run(c: Config, raws: readonly Raw[], seen?: ReturnType<typeof tally>) {
  const model = modelOf(c);
  const s = model.init();
  const heard: string[] = [];
  const win = createWindow({
    id: 'w', ...c.start, title: 'W', titlebar: c.titlebar, interior: c.interior,
    ...(c.minW !== undefined ? { minW: c.minW } : {}), ...(c.minH !== undefined ? { minH: c.minH } : {}),
    onMove: (b) => heard.push(`move ${b.x},${b.y},${b.w},${b.h}`),
    onResize: (b) => heard.push(`resize ${b.x},${b.y},${b.w},${b.h}`),
    onClose: () => heard.push('close'),
    onContentClick: (p) => heard.push(`click ${p.x},${p.y}`),
  });
  const cmds: Cmd[] = [];
  for (const raw of raws) {
    const cmd = concrete(s, raw);
    cmds.push(cmd);
    const deps = win.deps!(drawCtx(0, 0));
    const changed = model.step(s, cmd);
    switch (cmd.t) {
      case 'down': case 'move': case 'up': win.onPointer({ type: cmd.t, x: cmd.x, y: cmd.y, native: null }); break;
      case 'cancel': win.onPointer({ type: 'cancel', native: null }); break;
      case 'bounds': win.setBounds(cmd.b); break;
      case 'draw': win.draw(drawCtx(cmd.width, cmd.height)); break;
      case 'hide': win.setHidden(cmd.hidden); break;
    }
    expect(win.bounds).toEqual(s.b);
    expect(heard).toEqual(s.heard);
    expect(win.deps!(drawCtx(0, 0)) !== deps).toBe(changed);
    if (seen && changed && cmd.t === 'move') seen.hit(s.drag === 'title' ? 'moved' : 'resized');
    if (seen && cmd.t === 'cancel' && changed) seen.hit('put back');
  }
  if (seen) for (const h of s.heard) if (h === 'close' || h.startsWith('click')) seen.hit(h === 'close' ? 'close' : 'click');
  return { win, heard, cmds };
}

describe('createWindow', () => {
  it('moves, resizes, closes, and reports clicks as a model of its drag does', () => {
    const seen = tally();
    fc.assert(fc.property(config, cmdsFor, (c, raws) => { run(c, raws as Raw[], seen); }), runs(RUNS));
    seen.atLeast('moved', 5);
    seen.atLeast('resized', 20);
    seen.atLeast('put back', 2);
    seen.atLeast('click', 10);
    seen.atLeast('close', 1);
  }, timeoutFor(RUNS, 20));

  it('drags alike when the window and every point move together, with no canvas to keep it on', () => {
    const noDraws = cmdsFor.map((cs) => cs.filter((c) => c.t !== 'draw'));
    fc.assert(fc.property(config, noDraws, pt, pt, (c, raws, tx, ty) => {
      const shift = (r: Raw): Raw => {
        if (r.t === 'down') return r.rel ? r : { ...r, x: r.x + tx, y: r.y + ty };
        if (r.t === 'move' || r.t === 'up') return r.rel ? r : { ...r, x: r.x + tx, y: r.y + ty };
        if (r.t === 'bounds') return { ...r, b: { ...r.b, x: r.b.x + tx, y: r.b.y + ty } };
        return r;
      };
      const a = run(c, raws as Raw[]);
      const b = run({ ...c, start: { ...c.start, x: c.start.x + tx, y: c.start.y + ty } }, (raws as Raw[]).map(shift));
      expect(b.win.bounds).toEqual({ ...a.win.bounds, x: a.win.bounds.x + tx, y: a.win.bounds.y + ty });
      expect(b.heard.map((h) => h.split(' ')[0])).toEqual(a.heard.map((h) => h.split(' ')[0]));
    }), runs(RUNS));
  }, timeoutFor(RUNS, 20));
});
