/**
 * Property tests of the page fit and the page grid: a fit puts the page's center at the workspace's and the page
 * inside the padded workspace, touching it on one axis unless a zoom limit holds it, refits only when its key changes,
 * and answers the world origin without a page; the grid's snap lines run through the page's corner at its spacing.
 */
import { afterEach, describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { cleanup, renderHook } from '@testing-library/react';
import { DEFAULT_MAX_ZOOM, DEFAULT_MIN_ZOOM, HOME_VIEW, type View } from '@weasel-js/core';
import { usePageFit } from './usePageFit';
import { usePageGrid } from './usePageGrid';
import { runs, tally, timeoutFor } from './pbt.fixture';

const RUNS = 150;

afterEach(cleanup);

const size = fc.double({ min: 1, max: 4000, noNaN: true });
const coord = fc.double({ min: -1e5, max: 1e5, noNaN: true });

describe('usePageFit', () => {
  it('centers the page in the padded workspace, as large as fits, once per fit key', () => {
    const seen = tally();
    fc.assert(fc.property(
      fc.record({ width: fc.oneof({ weight: 4, arbitrary: fc.integer({ min: 1, max: 3000 }) }, fc.constant(0)), height: fc.oneof({ weight: 4, arbitrary: fc.integer({ min: 1, max: 3000 }) }, fc.constant(0)) }),
      fc.option(fc.record({ x: coord, y: coord, width: size, height: size }), { freq: 6 }),
      fc.integer({ min: 0, max: 200 }), fc.record({ width: fc.integer({ min: 1, max: 3000 }), height: fc.integer({ min: 1, max: 3000 }) }),
      (ws, page, padding, resized) => {
        const views: View[] = [];
        const hook = renderHook(({ dims, key }) => usePageFit(dims, key, page, (v) => views.push(v), { padding }),
          { initialProps: { dims: ws, key: 'one' } });
        if (ws.width === 0 || ws.height === 0) {
          seen.count('unmeasured');
          expect(views).toEqual([]);
          hook.unmount();
          return;
        }
        expect(views).toHaveLength(1);
        const v = views[0]!;
        if (page === null) {
          seen.count('no page');
          expect(v).toEqual(HOME_VIEW);
        } else {
          seen.count('fit');
          expect(v.scale.x).toBe(v.scale.y);
          const s = v.scale.x;
          const center = { x: (page.x + page.width / 2 - v.x) * s, y: (page.y + page.height / 2 - v.y) * s };
          const tol = 1e-9 * Math.max(1, Math.abs(page.x) * s, Math.abs(page.y) * s, ws.width, ws.height);
          expect(Math.abs(center.x - ws.width / 2)).toBeLessThanOrEqual(tol);
          expect(Math.abs(center.y - ws.height / 2)).toBeLessThanOrEqual(tol);
          const availW = Math.max(1, ws.width - padding * 2);
          const availH = Math.max(1, ws.height - padding * 2);
          const fits = Math.min(availW / page.width, availH / page.height);
          const want = Math.min(DEFAULT_MAX_ZOOM, Math.max(DEFAULT_MIN_ZOOM, fits));
          expect(Math.abs(s - want)).toBeLessThanOrEqual(1e-12 * want);
          if (fits > DEFAULT_MAX_ZOOM || fits < DEFAULT_MIN_ZOOM) seen.count('held by a limit');
        }
        hook.rerender({ dims: resized, key: 'one' });
        expect(views).toHaveLength(1);
        hook.rerender({ dims: resized, key: 'two' });
        expect(views).toHaveLength(2);
        hook.unmount();
      }), runs(RUNS));
    seen.atLeast('fit', RUNS / 4);
    seen.atLeast('no page', RUNS / 30);
    seen.atLeast('unmeasured', RUNS / 10);
    seen.atLeast('held by a limit', RUNS / 20);
  }, timeoutFor(RUNS, 30));
});

describe('usePageGrid', () => {
  it('snaps to lines through the page corner at its spacing', () => {
    const seen = tally();
    fc.assert(fc.property(fc.integer({ min: -1000, max: 1000 }), fc.integer({ min: -1000, max: 1000 }), fc.integer({ min: 1, max: 100 }),
      fc.integer({ min: -2000, max: 2000 }), fc.integer({ min: -2000, max: 2000 }),
      (x, y, spacing, px, py) => {
        const { result, unmount } = renderHook(() => usePageGrid({
          page: { x, y, width: 500, height: 400 }, spacing, background: '#ffffff', accentEvery: 5, visible: true, snap: true,
        }));
        const probe = { x: px + 0.25, y: py + 0.25 };
        const query = { gesture: 'point', probes: [{ id: 'pointer', at: probe, role: 'pointer' }], delta0: { x: 0, y: 0 } };
        const at = [...result.current.source!.collect(query as never)].map((t) => t.locus.at as { x: number; y: number });
        const nearest = (p: number, o: number) => o + Math.round((p - o) / spacing) * spacing;
        expect(at).toContainEqual({ x: nearest(probe.x, x), y: probe.y });
        expect(at).toContainEqual({ x: probe.x, y: nearest(probe.y, y) });
        for (const a of at) {
          const onX = Number.isInteger((a.x - x) / spacing);
          const onY = Number.isInteger((a.y - y) / spacing);
          expect(onX || onY).toBe(true);
        }
        seen.count('snapped');
        unmount();
      }), runs(RUNS));
    seen.atLeast('snapped', RUNS);
  }, timeoutFor(RUNS, 30));
});
