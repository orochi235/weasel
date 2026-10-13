import { describe, it, expect, vi } from 'vitest';
import { type PolygonPath, pathFromD } from '@weasel-js/geom';
import { setup } from './testing/penHarness';

// The real layer, recorded: the pen keeps its state to itself, and the one
// place it hands that object out is to the preview layer that paints from it.
vi.mock('features/paths/penPreviewLayer', async (importOriginal) => {
  const actual = await importOriginal<typeof import('features/paths/penPreviewLayer')>();
  return { ...actual, createPenPreviewLayer: vi.fn(actual.createPenPreviewLayer) };
});

describe('usePenTool', () => {
  describe('snapPoint', () => {
    const SPACING = 10;
    const grid = (p: { x: number; y: number }) => ({
      x: Math.round(p.x / SPACING) * SPACING,
      y: Math.round(p.y / SPACING) * SPACING,
    });

    it('snaps corner-anchor click placement to the grid', () => {
      const p = setup({ snapPoint: grid });
      p.click(12, 18);
      expect(p.scratch.current!.anchors).toEqual([{ x: 10, y: 20 }]);
    });

    it('snaps the smooth-anchor base point at drag start', () => {
      const p = setup({ snapPoint: grid });
      p.drag({ x: 23, y: 7 }, { x: 60, y: 7 });
      expect(p.scratch.current!.anchors[0].x).toBe(20);
      expect(p.scratch.current!.anchors[0].y).toBe(10);
    });

    it('snaps the outgoing-handle target while dragging a handle', () => {
      const p = setup({ snapPoint: grid });
      p.drag({ x: 0, y: 0 }, { x: 27, y: 32 });
      expect(p.scratch.current!.anchors[0].outHandle).toEqual({ x: 30, y: 30 });
    });

    it('passthrough (no snapPoint) preserves raw coords', () => {
      const p = setup();
      p.click(12, 18);
      expect(p.scratch.current!.anchors).toEqual([{ x: 12, y: 18 }]);
    });
  });

  describe('snapping to existing anchors', () => {
    const poly = (d: string) => pathFromD(d) as PolygonPath;
    const paths = { n1: poly('M 0 0 L 100 0 L 100 100 Z'), n2: poly('M 300 0 L 400 0 L 500 0') };

    it('a click near an existing anchor lands exactly on it', () => {
      const p = setup({ paths });
      p.click(-50, -50);
      p.click(103, 96);
      expect(p.scratch.current!.anchors[1]).toEqual({ x: 100, y: 100 });
    });

    it('snaps to interior anchors too, and starts a new path on one from idle', () => {
      const p = setup({ paths });
      p.click(402, 3);
      expect(p.scratch.current!.anchors).toEqual([{ x: 400, y: 0 }]);
      expect(p.scratch.continuing).toBeNull();
    });

    it('snaps the smooth-anchor base point at drag start', () => {
      const p = setup({ paths });
      p.click(-50, -50);
      p.drag({ x: 97, y: 2 }, { x: 150, y: 50 });
      expect(p.scratch.current!.anchors[1]).toMatchObject({ x: 100, y: 0 });
    });

    it('beats grid snapping, which still applies away from anchors', () => {
      const grid = (q: { x: number; y: number }) => ({ x: Math.round(q.x / 30) * 30, y: Math.round(q.y / 30) * 30 });
      const p = setup({ paths, snapPoint: grid });
      p.click(-50, -50);
      p.click(96, 104);
      expect(p.scratch.current!.anchors[1]).toEqual({ x: 100, y: 100 });
      // 6px off an anchor at 1x: outside the default radius, so the grid wins.
      p.click(206, 0);
      expect(p.scratch.current!.anchors[2]).toEqual({ x: 210, y: 0 });
    });

    it('measures the radius in screen px', () => {
      const p = setup({ paths, scale: 4 });
      p.click(-50, -50);
      p.click(103, 100);
      expect(p.scratch.current!.anchors[1]).toEqual({ x: 103, y: 100 });
      p.click(101, 100);
      expect(p.scratch.current!.anchors[2]).toEqual({ x: 100, y: 100 });
    });

    it('anchorSnapRadius sets the radius; 0 turns snapping off', () => {
      const wide = setup({ paths, anchorSnapRadius: 20 });
      wide.click(-50, -50);
      wide.click(115, 100);
      expect(wide.scratch.current!.anchors[1]).toEqual({ x: 100, y: 100 });
      const off = setup({ paths, anchorSnapRadius: 0 });
      off.click(-50, -50);
      off.click(101, 100);
      expect(off.scratch.current!.anchors[1]).toEqual({ x: 101, y: 100 });
    });
  });
});
