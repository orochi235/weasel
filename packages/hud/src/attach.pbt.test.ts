/**
 * Property tests of an attached HUD's layer: which widget a point lands on through a stack of rects, images, buttons,
 * and windows (claiming or decoration, hidden or showing, interiors that pass), against a model of each kind's
 * geometry; the hover reports a pointer's moves and leaves give through a stack that changes under it; and the
 * layer's commands, cached a frame to the next, against every widget drawn afresh.
 */
import { describe, expect, it, vi } from 'vitest';
import fc from 'fast-check';
import type { CanvasExtensionApi, ClaimableGesture, LayerHit, RenderLayer } from '@weasel-js/core';
import { createPaintedCursorState } from '@weasel-js/core';
import { resolveTheme, weaselTheme } from '@weasel-js/theme';
import { attachHud } from './attach';
import { hudColor } from './colors';
import { createHud, type Hud } from './hud';
import type { HudPointerEvent, Widget, WidgetBounds } from './widget';
import { DEFAULT_WINDOW_METRICS as M } from './widgets/window/zones';
import { runs, tally, timeoutFor } from './pbt.fixture';

const RUNS = 150;
const VIEW = { x: 0, y: 0, scale: { x: 1, y: 1 } };

function attached() {
  let layer: RenderLayer<unknown> | undefined;
  const api: CanvasExtensionApi = {
    element: null, surface: null,
    getSurfaceRect: () => ({ x: 0, y: 0, width: 0, height: 0 }),
    clientToWorld: (x: number, y: number): [number, number] => [x, y],
    requestRedraw: vi.fn(), subscribeFrame: vi.fn(() => () => {}),
    subscribeBeforePaint: vi.fn(() => () => {}), subscribeResume: vi.fn(() => () => {}),
    hitTestExtras: vi.fn(() => null),
    registerLayer: vi.fn((l: RenderLayer<unknown>) => { layer = l; return () => {}; }),
    getView: vi.fn(() => VIEW), setView: vi.fn(), subscribeView: vi.fn(() => () => {}),
    getPaintedVersion: vi.fn(() => 0), paintedCursor: createPaintedCursorState(),
    cursorSink: { setBase() {}, setOverride() {} }, getDebug: () => null,
    pickAt: async () => 0,
    readIds: async () => ({ x: 0, y: 0, width: 0, height: 0, data: new Uint32Array(0) }), readIdsSync: () => null, worker: null,
  };
  const hud = createHud();
  const detach = attachHud(api, hud, { font: 'sans-serif' });
  return { hud, layer: layer!, detach };
}

type Kind = 'rect' | 'image' | 'button' | 'window';
interface Spec {
  kind: Kind;
  b: WidgetBounds;
  claims: readonly ClaimableGesture[];
  hidden: boolean;
  titlebar: boolean;
  pass: boolean;
}

const spec: fc.Arbitrary<Spec> = fc.record({
  kind: fc.constantFrom<Kind>('rect', 'image', 'button', 'window'),
  b: fc.record({ x: fc.integer({ min: 0, max: 200 }), y: fc.integer({ min: 0, max: 150 }), w: fc.integer({ min: 80, max: 200 }), h: fc.integer({ min: 76, max: 150 }) }),
  claims: fc.constantFrom<readonly ClaimableGesture[]>([], ['pointer'], ['wheel'], ['pointer', 'contextMenu']),
  hidden: fc.boolean(),
  titlebar: fc.boolean(),
  pass: fc.boolean(),
});

const IMAGE = {} as ImageBitmap;

function build(hud: Hud, s: Spec, i: number): Widget {
  const id = `w${i}`;
  const o = { id, ...s.b };
  let w: Widget & { setHidden(h: boolean): void };
  if (s.kind === 'rect') w = hud.rect({ ...o, fill: '#000', claims: s.claims });
  else if (s.kind === 'image') w = hud.image({ ...o, image: IMAGE, claims: s.claims });
  else if (s.kind === 'button') w = hud.button({ ...o, label: id });
  else w = hud.window({ ...o, title: id, titlebar: s.titlebar, interior: s.pass ? 'pass' : 'claim' });
  w.setHidden(s.hidden);
  return w;
}

const inRect = (b: WidgetBounds, x: number, y: number) => x >= b.x && x < b.x + b.w && y >= b.y && y < b.y + b.h;

/** What the point `(x, y)` lands on, from each widget's geometry: the topmost showing widget it is inside that
 *  takes a press, unless a passing interior above lets it through to nothing at all. */
function modelHit(specs: readonly Spec[], x: number, y: number): number | null {
  for (let i = specs.length - 1; i >= 0; i--) {
    const s = specs[i]!;
    if (s.hidden || !inRect(s.b, x, y)) continue;
    if (s.kind === 'window') {
      const top = s.titlebar ? M.titleH : s.pass ? M.grip : M.edge;
      const interior = x >= s.b.x + M.edge && x < s.b.x + s.b.w - M.edge && y >= s.b.y + top && y < s.b.y + s.b.h - M.edge;
      if (s.pass && interior) return null;
      return i;
    }
    // Buttons and windows take the default claims; rects and images are decoration unless they claim.
    if (s.kind === 'button' || s.claims.length > 0) return i;
  }
  return null;
}

const point = fc.record({ x: fc.integer({ min: -5, max: 405 }), y: fc.integer({ min: -5, max: 305 }) });

describe('attachHud layer', () => {
  it('lands a point on the widget a model of the stack names, with its claims and cursor', () => {
    const seen = tally();
    fc.assert(fc.property(fc.array(spec, { minLength: 1, maxLength: 8 }), fc.array(point, { minLength: 1, maxLength: 20 }), (specs, pts) => {
      const { hud, layer } = attached();
      const ws = specs.map((s, i) => build(hud, s, i));
      for (const p of pts) {
        const hit = layer.hitTest!(p.x, p.y, null, VIEW, { width: 400, height: 300 }) as LayerHit<{ widget: Widget }> | null;
        const want = modelHit(specs, p.x, p.y);
        expect(hit === null ? null : ws.indexOf(hit.initialScratch!.widget)).toBe(want);
        if (hit) {
          const w = hit.initialScratch!.widget;
          expect(hit.claimedKinds).toEqual(w.claims ?? ['pointer', 'doubleClick', 'contextMenu', 'longPress']);
          seen.hit(specs[want!]!.kind);
        } else if (specs.some((s) => !s.hidden && inRect(s.b, p.x, p.y))) seen.hit('through');
      }
    }), runs(RUNS));
    for (const k of ['rect', 'image', 'button', 'window', 'through']) seen.atLeast(k, 10);
  }, timeoutFor(RUNS, 20));

  type Step =
    | { t: 'move'; x: number; y: number }
    | { t: 'leave' }
    | { t: 'hide'; i: number; hidden: boolean }
    | { t: 'remove'; i: number };
  const step: fc.Arbitrary<Step> = fc.oneof(
    { arbitrary: fc.record({ t: fc.constant('move' as const), x: point.map((p) => p.x), y: point.map((p) => p.y) }), weight: 6 },
    fc.constant({ t: 'leave' as const }),
    fc.record({ t: fc.constant('hide' as const), i: fc.nat({ max: 7 }), hidden: fc.boolean() }),
    fc.record({ t: fc.constant('remove' as const), i: fc.nat({ max: 7 }) }),
  );

  it('reports hover moves to the widget under the pointer and one leave to each it leaves, through a changing stack', () => {
    const seen = tally();
    fc.assert(fc.property(fc.array(spec, { minLength: 1, maxLength: 8 }), fc.array(step, { maxLength: 40 }), fc.boolean(), (specs, steps, detachAtEnd) => {
      const { hud, layer, detach } = attached();
      const ws = specs.map((s, i) => build(hud, s, i));
      const order = specs.map((_, i) => i);
      const live = specs.map((s) => ({ ...s }));
      const heard: string[] = [];
      ws.forEach((w, i) => {
        const real = w.onPointer.bind(w);
        w.onPointer = (e: HudPointerEvent) => { heard.push(e.type === 'hovermove' ? `move ${i}` : e.type === 'hoverleave' ? `leave ${i}` : e.type); real(e); };
      });
      const want: string[] = [];
      let over: number | null = null;
      const leave = () => { if (over !== null) { want.push(`leave ${over}`); over = null; } };
      for (const s of steps) {
        if (s.t === 'move') {
          const hit = modelHit(order.map((i) => live[i]!), s.x, s.y);
          const at = hit === null ? null : order[hit]!;
          if (at !== over) { leave(); over = at; }
          if (at !== null) { want.push(`move ${at}`); seen.hit('over'); }
          layer.onUncapturedMove!(s.x, s.y, null as never, VIEW, { width: 400, height: 300 });
        } else if (s.t === 'leave') {
          leave();
          layer.onUncapturedLeave!();
        } else {
          const i = s.i % ws.length;
          const w = ws[i]! as Widget & { setHidden(h: boolean): void };
          if (s.t === 'hide') { if (!w.disposed) { w.setHidden(s.hidden); live[i]!.hidden = s.hidden; } }
          else { hud.remove(w); const k = order.indexOf(i); if (k >= 0) order.splice(k, 1); }
        }
        expect(heard).toEqual(want);
      }
      if (detachAtEnd) { leave(); detach(); expect(heard).toEqual(want); }
    }), runs(RUNS));
    seen.atLeast('over', 50);
  }, timeoutFor(RUNS, 20));

  it('paints from its frame cache what every widget would draw afresh', () => {
    const tokens = resolveTheme(weaselTheme);
    const color = hudColor({ theme: weaselTheme, resolved: tokens });
    type Edit =
      | { t: 'bounds'; i: number; b: WidgetBounds }
      | { t: 'hide'; i: number; hidden: boolean }
      | { t: 'press'; i: number; type: 'down' | 'up' | 'hovermove' | 'hoverleave'; x: number; y: number }
      | { t: 'focus'; i: number; visible: boolean }
      | { t: 'dims'; width: number; height: number }
      | { t: 'label'; i: number; s: string };
    const edit: fc.Arbitrary<Edit> = fc.oneof(
      fc.record({ t: fc.constant('bounds' as const), i: fc.nat({ max: 7 }), b: spec.map((s) => s.b) }),
      fc.record({ t: fc.constant('hide' as const), i: fc.nat({ max: 7 }), hidden: fc.boolean() }),
      fc.record({ t: fc.constant('press' as const), i: fc.nat({ max: 7 }), type: fc.constantFrom('down' as const, 'up' as const, 'hovermove' as const, 'hoverleave' as const), x: point.map((p) => p.x), y: point.map((p) => p.y) }),
      fc.record({ t: fc.constant('focus' as const), i: fc.nat({ max: 8 }), visible: fc.boolean() }),
      fc.record({ t: fc.constant('dims' as const), width: fc.integer({ min: 0, max: 600 }), height: fc.integer({ min: 0, max: 400 }) }),
      fc.record({ t: fc.constant('label' as const), i: fc.nat({ max: 7 }), s: fc.string({ maxLength: 6 }) }),
    );
    fc.assert(fc.property(fc.array(spec, { minLength: 1, maxLength: 8 }), fc.array(edit, { maxLength: 30 }), (specs, edits) => {
      const { hud, layer } = attached();
      const ws = specs.map((s, i) => build(hud, s, i)) as (Widget & Record<string, (...a: unknown[]) => void>)[];
      let dims = { width: 400, height: 300, dpr: 1 };
      const fresh = () => {
        const ctx = { dims, defaultFont: 'sans-serif', tokens, color };
        return hud.widgets().filter((w) => !w.hidden).flatMap((w) => w.draw(ctx));
      };
      const paint = () => layer.draw(null, VIEW, { ...dims }).filter((c) => c.kind !== 'group');
      const ring = () => (hud.focused && hud.focusVisible && !hud.focused.hidden ? 1 : 0);
      paint();
      for (const e of edits) {
        const w = 'i' in e ? ws[e.i % ws.length]! : null;
        if (e.t === 'bounds') w!.setBounds(e.b);
        else if (e.t === 'hide') w!.setHidden(e.hidden);
        else if (e.t === 'press') w!.onPointer({ type: e.type, x: e.x, y: e.y, native: null } as HudPointerEvent);
        else if (e.t === 'focus') hud.focus(e.i >= ws.length ? null : ws[e.i]!, { visible: e.visible });
        else if (e.t === 'dims') dims = { width: e.width, height: e.height, dpr: 1 };
        else if (w!.setFill) w!.setFill(`#${e.s.length}00`);
        else (w!.setLabel ?? w!.setTitle ?? (() => {}))(e.s);
        const got = paint();
        const want = fresh();
        expect(got.slice(0, got.length - ring())).toEqual(want);
      }
    }), runs(RUNS));
  }, timeoutFor(RUNS, 30));
});
