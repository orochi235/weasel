/**
 * Property tests of HUD widgets at the edges of their inputs: sizes that are zero, negative, `NaN`, or endless given
 * to the factories that check them; points that are not finite, which land on no widget and move no window; a hit
 * test that moves with its widget; and widget ids named like `Object.prototype` members.
 */
import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { resolveTheme, weaselTheme } from '@weasel-js/theme';
import { runs, tally } from '../pbt.fixture';
import { createHud } from '../hud';
import type { Widget } from '../widget';
import { createButton } from './button';
import { createImage } from './image';
import { createRect } from './rect';
import { createWindow } from './window/window';
import { createList } from './list/list';

const RUNS = 300;
const IMAGE = {} as ImageBitmap;

const size = fc.oneof(
  fc.integer({ min: -50, max: 400 }),
  fc.constantFrom(0, -0, Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY, Number.MIN_VALUE, 1e308),
  fc.double({ min: -10, max: 10 }),
);
const finite = fc.integer({ min: -500, max: 500 });
const notFinite = fc.constantFrom(Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY);
const wild = fc.oneof(finite, notFinite);
/** An offset from a widget's corner: inside it, near its edges, or not finite. */
const near = fc.oneof({ weight: 3, arbitrary: fc.integer({ min: -10, max: 310 }) }, notFinite);

type Make = (o: { id: string; x: number; y: number; w: number; h: number }) => Widget;
const CHECKED: [string, Make][] = [
  ['rect', (o) => createRect({ ...o, fill: '#000' })],
  ['image', (o) => createImage({ ...o, image: IMAGE })],
  ['button', (o) => createButton({ ...o, label: 'b' })],
];
const ALL: [string, Make][] = [
  ...CHECKED,
  ['window', (o) => createWindow({ ...o, title: 'w' })],
  ['bare window', (o) => createWindow({ ...o, title: 'w', titlebar: false })],
  ['list', (o) => createList({ ...o, rows: [{ id: 'a', label: 'A' }] })],
];

describe('widget edges', () => {
  it('a factory that checks its size refuses one that is not positive, NaN included, and takes any other', () => {
    const seen = tally();
    fc.assert(fc.property(fc.constantFrom(...CHECKED), size, size, ([, make], w, h) => {
      const ok = w > 0 && h > 0;
      if (ok) expect(() => make({ id: 'x', x: 0, y: 0, w, h })).not.toThrow();
      else expect(() => make({ id: 'x', x: 0, y: 0, w, h })).toThrow();
      seen.hit(ok ? 'taken' : Number.isNaN(w) || Number.isNaN(h) ? 'NaN' : 'refused');
    }), runs(RUNS));
    for (const k of ['taken', 'refused', 'NaN']) seen.atLeast(k, 20);
  });

  it('lands no point that is not finite on any widget, and lands a finite one alike when both move together', () => {
    const seen = tally();
    fc.assert(fc.property(
      fc.constantFrom(...ALL), finite, finite, fc.integer({ min: 80, max: 300 }), fc.integer({ min: 80, max: 300 }),
      near, near, finite, finite,
      ([, make], x, y, w, h, ox, oy, dx, dy) => {
        const a = make({ id: 'x', x, y, w, h });
        const px = x + ox, py = y + oy;
        if (!Number.isFinite(px) || !Number.isFinite(py)) {
          expect(a.hitTest(px, py)).toBe(false);
          seen.hit('not finite');
          return;
        }
        const b = make({ id: 'x', x: x + dx, y: y + dy, w, h });
        expect(b.hitTest(px + dx, py + dy)).toBe(a.hitTest(px, py));
        seen.hit(a.hitTest(px, py) ? 'in' : 'out');
      }), runs(RUNS));
    for (const k of ['not finite', 'in', 'out']) seen.atLeast(k, 20);
  });

  it('keeps a window where it is through presses and moves at points that are not finite', () => {
    const seen = tally();
    const pt = fc.record({ x: wild, y: wild });
    const ev = fc.record({ type: fc.constantFrom('down' as const, 'move' as const, 'up' as const), p: pt });
    fc.assert(fc.property(fc.boolean(), fc.array(ev, { maxLength: 12 }), fc.boolean(), (titlebar, evs, drawn) => {
      const heard: unknown[] = [];
      const win = createWindow({
        id: 'w', x: 50, y: 40, w: 200, h: 150, title: 'w', titlebar,
        onMove: (b) => heard.push(b), onResize: (b) => heard.push(b), onContentClick: (p) => heard.push(p), onClose: () => heard.push('close'),
      });
      if (drawn) win.draw({ dims: { width: 800, height: 600 }, defaultFont: 'D', color: () => '#000', tokens: resolveTheme(weaselTheme) });
      // A press in the title bar first, so a move has a drag to act on.
      win.onPointer({ type: 'down', x: 60, y: 50, native: null });
      for (const e of evs) {
        const before = win.bounds;
        win.onPointer({ type: e.type, x: e.p.x, y: e.p.y, native: null });
        const b = win.bounds;
        expect([b.x, b.y, b.w, b.h].every(Number.isFinite)).toBe(true);
        if (!Number.isFinite(e.p.x) || !Number.isFinite(e.p.y)) {
          expect(b).toEqual(before);
          seen.hit('not finite');
        }
      }
      for (const h of heard) if (typeof h === 'object') expect(Object.values(h as object).every(Number.isFinite)).toBe(true);
    }), runs(RUNS));
    seen.atLeast('not finite', 50);
  });

  it('holds widgets with ids named like Object.prototype members as it holds any', () => {
    const names = fc.constantFrom('__proto__', 'constructor', 'toString', 'hasOwnProperty', 'valueOf', 'a');
    fc.assert(fc.property(fc.array(names, { minLength: 1, maxLength: 6 }), (ids) => {
      const hud = createHud();
      const ws = ids.map((id, i) => hud.button({ id, x: i * 10, y: 0, w: 10, h: 10, label: id }));
      expect(hud.widgets()).toEqual(ws);
      expect(hud.tabOrder()).toEqual(ws);
      for (const w of ws) expect(hud.focus(w)).toBe(true);
      hud.focus(null);
      expect(hud.moveFocus('next')).toBe(ws[0]);
    }), runs(100));
  });
});
