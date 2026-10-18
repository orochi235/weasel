import { describe, it, expect, vi } from 'vitest';
import { type PolygonPath, pathFromD } from '@weasel-js/geom';
import { pathSnapSource } from 'features/paths/pathSnap/pathSnapSource';
import { ANCHORS_ONLY, gridSource } from 'features/snap/testing/sessionDep';
import { setup } from './testing/penHarness';

// The real layer, recorded: the pen keeps its state to itself, and the one
// place it hands that object out is to the preview layer that paints from it.
vi.mock('features/paths/penPreviewLayer', async (importOriginal) => {
  const actual = await importOriginal<typeof import('features/paths/penPreviewLayer')>();
  return { ...actual, createPenPreviewLayer: vi.fn(actual.createPenPreviewLayer) };
});

const anchors = pathSnapSource({ kinds: ANCHORS_ONLY });

describe('usePenTool', () => {
  describe('snapping through the snap dep', () => {
    const grid = [gridSource(10)];

    it('snaps corner-anchor click placement to the grid', () => {
      const p = setup({ snap: grid });
      p.click(12, 18);
      expect(p.scratch.current!.anchors).toEqual([{ x: 10, y: 20 }]);
    });

    it('snaps the smooth-anchor base point at drag start', () => {
      const p = setup({ snap: grid });
      p.drag({ x: 23, y: 7 }, { x: 60, y: 7 });
      expect(p.scratch.current!.anchors[0].x).toBe(20);
      expect(p.scratch.current!.anchors[0].y).toBe(10);
    });

    it('snaps the outgoing-handle target while dragging a handle', () => {
      const p = setup({ snap: grid });
      p.drag({ x: 0, y: 0 }, { x: 27, y: 32 });
      expect(p.scratch.current!.anchors[0].outHandle).toEqual({ x: 30, y: 30 });
    });

    it('places a click unsnapped while Ctrl suspends snapping', () => {
      const p = setup({ snap: grid });
      p.drag({ x: 12, y: 18 }, { x: 27, y: 32 }, { ctrl: true });
      expect(p.scratch.current!.anchors[0]).toMatchObject({ x: 12, y: 18, outHandle: { x: 27, y: 32 } });
    });
  });

  describe('snapping to existing anchors', () => {
    const poly = (d: string) => pathFromD(d) as PolygonPath;
    const paths = { n1: poly('M 0 0 L 100 0 L 100 100 Z'), n2: poly('M 300 0 L 400 0 L 500 0') };

    it('a click near an existing anchor lands exactly on it', () => {
      const p = setup({ paths, snap: [anchors] });
      p.click(-50, -50);
      p.click(103, 96);
      expect(p.scratch.current!.anchors[1]).toEqual({ x: 100, y: 100 });
    });

    it('snaps to interior anchors too, and starts a new path on one from idle', () => {
      const p = setup({ paths, snap: [anchors] });
      p.click(402, 3);
      expect(p.scratch.current!.anchors).toEqual([{ x: 400, y: 0 }]);
      expect(p.scratch.continuing).toBeNull();
    });

    it('snaps the smooth-anchor base point at drag start', () => {
      const p = setup({ paths, snap: [anchors] });
      p.click(-50, -50);
      p.drag({ x: 97, y: 2 }, { x: 150, y: 50 });
      expect(p.scratch.current!.anchors[1]).toMatchObject({ x: 100, y: 0 });
    });

    it('beats grid snapping, which still applies away from anchors', () => {
      const p = setup({ paths, snap: [anchors, gridSource(30)] });
      p.click(-50, -50);
      p.click(96, 104);
      expect(p.scratch.current!.anchors[1]).toEqual({ x: 100, y: 100 });
      p.click(206, 0);
      expect(p.scratch.current!.anchors[2]).toEqual({ x: 210, y: 0 });
    });

    it('measures the reach in screen px', () => {
      const p = setup({ paths, snap: [anchors], scale: 4 });
      p.click(-50, -50);
      p.click(103, 100);
      expect(p.scratch.current!.anchors[1]).toEqual({ x: 103, y: 100 });
      p.click(101, 100);
      expect(p.scratch.current!.anchors[2]).toEqual({ x: 100, y: 100 });
    });

    it("takes the source's reach, and lands unsnapped with no source", () => {
      const wide = setup({ paths, snap: [pathSnapSource({ kinds: ANCHORS_ONLY, reachPx: 20 })] });
      wide.click(-50, -50);
      wide.click(115, 100);
      expect(wide.scratch.current!.anchors[1]).toEqual({ x: 100, y: 100 });
      const off = setup({ paths });
      off.click(-50, -50);
      off.click(101, 100);
      expect(off.scratch.current!.anchors[1]).toEqual({ x: 101, y: 100 });
    });
  });
});
