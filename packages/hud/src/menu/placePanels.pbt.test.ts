/**
 * Property tests of where a HUD menu's panels go: each sized to its rows, inside the canvas whenever it fits, the
 * first at its anchor or its button, each submenu beside the row it hangs from, and a level placed once for as long
 * as it stays open.
 */
import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { createMenuController, type Rect } from '@weasel-js/menu';
import { menuLevel, openPath, runs, tally, timeoutFor } from '../pbt.fixture';
import { menuRowSpans } from '@weasel-js/ui-logic';
import { panelSize } from './drawPanel';
import { menuTheme } from './menu.fixture';
import { menuMeasureEnv } from './menuEnv';
import { estimateWidth } from './measureLabel';
import { createPlacer } from './placePanels';

const RUNS = 200;

/** Where across the canvas, often near its far end, where a panel has to flip. */
const across = fc.oneof(fc.double({ min: 0, max: 1, noNaN: true }), fc.double({ min: 0.7, max: 1, noNaN: true }));

const scene = fc.record({
  entries: menuLevel(3),
  path: fc.array(fc.nat(), { maxLength: 4 }),
  theme: menuTheme,
  canvas: fc.record({ width: fc.integer({ min: 50, max: 1600 }), height: fc.integer({ min: 50, max: 1200 }) }),
  anchor: fc.record({ x: across, y: across }),
  under: fc.option(fc.record({
    x: across, y: across,
    w: fc.integer({ min: 0, max: 120 }), h: fc.integer({ min: 0, max: 40 }),
  }), { nil: undefined }),
  perChar: fc.double({ min: 0.2, max: 1.2, noNaN: true }),
  family: fc.option(fc.constant('Inter'), { nil: null }),
});
type Scene = typeof scene extends fc.Arbitrary<infer T> ? T : never;

function placeAll(s: Scene) {
  const c = createMenuController({ entries: s.entries, onClose: () => {} });
  openPath(c, s.path);
  const anchor = { x: s.anchor.x * s.canvas.width, y: s.anchor.y * s.canvas.height };
  const under = s.under && { ...s.under, x: s.under.x * Math.max(0, s.canvas.width - s.under.w), y: s.under.y * Math.max(0, s.canvas.height - s.under.h) };
  const measure = (t: string, size: number) => t.length * size * s.perChar;
  const place = createPlacer({ anchor, under, canvasSize: () => s.canvas, measure });
  const rects = place(c, s.family, s.theme.tokens).map((p) => p.rect);
  const sized = (t: string, size: number) => (s.family === null ? estimateWidth(t, size) : measure(t, size));
  return { c, rects, anchor, under, place, sized };
}

const fits = (len: number, span: number) => len <= span;

describe('createPlacer', () => {
  it('sizes each panel to its rows and keeps it inside the canvas when it fits', () => {
    const seen = tally();
    fc.assert(fc.property(scene, (s) => {
      const { c, rects, sized } = placeAll(s);
      expect(rects).toHaveLength(c.stack().length);
      rects.forEach((r, level) => {
        expect([r.x, r.y, r.w, r.h].every(Number.isFinite)).toBe(true);
        const size = panelSize(c.entriesAt(level), menuMeasureEnv(s.theme.tokens, '', sized));
        expect({ w: r.w, h: r.h }).toEqual(size);
        if (fits(r.w, s.canvas.width)) { expect(r.x).toBeGreaterThanOrEqual(0); expect(r.x + r.w).toBeLessThanOrEqual(s.canvas.width); seen.hit('fits x'); }
        else expect(r.x).toBe(0);
        if (fits(r.h, s.canvas.height)) { expect(r.y).toBeGreaterThanOrEqual(0); expect(r.y + r.h).toBeLessThanOrEqual(s.canvas.height); seen.hit('fits y'); }
        else expect(r.y).toBe(0);
        if (level > 0) seen.hit('submenu');
      });
    }), runs(RUNS));
    for (const k of ['fits x', 'fits y', 'submenu']) seen.atLeast(k, 20);
  }, timeoutFor(RUNS, 10));

  it('opens the first panel down and right of the anchor, flipping an axis that does not fit', () => {
    const seen = tally();
    fc.assert(fc.property(scene.filter((s) => s.under === undefined), (s) => {
      const { rects: [r], anchor } = placeAll(s);
      const { width: W, height: H } = s.canvas;
      const axis = (at: number, len: number, span: number, got: number, name: string) => {
        if (at + len <= span) { expect(got).toBe(at); seen.hit(`${name} down`); }
        else if (at - len >= 0) { expect(got).toBe(at - len); seen.hit(`${name} flipped`); }
      };
      axis(anchor.x, r!.w, W, r!.x, 'x');
      axis(anchor.y, r!.h, H, r!.y, 'y');
    }), runs(RUNS));
    for (const k of ['x down', 'x flipped', 'y down', 'y flipped']) seen.atLeast(k, 10);
  }, timeoutFor(RUNS, 10));

  it('opens the first panel below its button, left-aligned, else above it or right-aligned', () => {
    const seen = tally();
    fc.assert(fc.property(scene.filter((s) => s.under !== undefined), (s) => {
      const { rects: [r], under } = placeAll(s);
      const u = under!;
      const { width: W, height: H } = s.canvas;
      if (u.y + u.h + r!.h <= H) { expect(r!.y).toBe(u.y + u.h); seen.hit('below'); }
      else if (u.y - r!.h >= 0) { expect(r!.y).toBe(u.y - r!.h); seen.hit('above'); }
      if (u.x + r!.w <= W) { expect(r!.x).toBe(u.x); seen.hit('left-aligned'); }
      else if (u.x + u.w - r!.w >= 0 && r!.w <= W) { expect(r!.x).toBe(u.x + u.w - r!.w); seen.hit('right-aligned'); }
    }), runs(RUNS));
    for (const k of ['below', 'above', 'left-aligned', 'right-aligned']) seen.atLeast(k, 10);
  }, timeoutFor(RUNS, 10));

  it('sets each submenu beside the row it hangs from, top-aligned with it, on the side it fits', () => {
    const seen = tally();
    fc.assert(fc.property(scene, (s) => {
      const { c, rects } = placeAll(s);
      const stack = c.stack();
      for (let level = 1; level < rects.length; level++) {
        const parent = rects[level - 1]!, r = rects[level]!;
        const row = menuRowSpans(c.entriesAt(level - 1), s.theme.m)[stack[level - 1]!]!;
        const right = parent.x + parent.w;
        if (right + r.w <= s.canvas.width) { expect(r.x).toBe(right); seen.hit('right'); }
        else if (parent.x - r.w >= 0) { expect(r.x + r.w).toBeCloseTo(parent.x, 9); seen.hit('left'); }
        expect(r.y).toBe(Math.max(0, Math.min(parent.y + row.y, s.canvas.height - r.h)));
      }
    }), runs(RUNS));
    for (const k of ['right', 'left']) seen.atLeast(k, 10);
  }, timeoutFor(RUNS, 10));

  it('keeps the rect of each level that stays open while deeper ones open and close', () => {
    const seen = tally();
    fc.assert(fc.property(scene, fc.array(fc.nat(), { maxLength: 3 }), (s, more) => {
      const { c, rects, place } = placeAll(s);
      expect(place(c, s.family, s.theme.tokens).map((p) => p.rect)).toEqual(rects);
      const depth = c.stack().length;
      openPath(c, more);
      const after: Rect[] = place(c, s.family, s.theme.tokens).map((p) => p.rect);
      if (c.stack().length > depth) seen.hit('deeper');
      expect(after.slice(0, depth)).toEqual(rects);
    }), runs(RUNS));
    seen.atLeast('deeper', 10);
  }, timeoutFor(RUNS, 10));
});
