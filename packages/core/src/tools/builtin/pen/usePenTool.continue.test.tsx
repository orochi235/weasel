import { describe, it, expect, vi } from 'vitest';
import { type PolygonPath, pathFromD } from '@weasel-js/geom';
import { pathToAnchors, remapPointValues } from '@weasel-js/geom';
import { hitTestArea } from 'canvas/deps/hitTestArea';
import { resolveEditablePathOf } from 'canvas/deps/editAnchors';
import type { Scene } from 'core/scene/types';
import { IDENTITY_POSE_COMPOSITION } from 'core/scene/composePose';
import { setup } from './testing/penHarness';

// The real layer, recorded: the pen keeps its state to itself, and the one
// place it hands that object out is to the preview layer that paints from it.
vi.mock('features/paths/penPreviewLayer', async (importOriginal) => {
  const actual = await importOriginal<typeof import('features/paths/penPreviewLayer')>();
  return { ...actual, createPenPreviewLayer: vi.fn(actual.createPenPreviewLayer) };
});

describe('usePenTool', () => {
  describe('continuing an existing open path', () => {
    const poly = (d: string) => pathFromD(d) as PolygonPath;
    const pointsOf = (path: unknown) =>
      pathToAnchors(path as PolygonPath).anchors.map((sub) => sub.map((a) => [a.x, a.y]));

    it('pressing the last anchor picks the path up, and later clicks append to that node', () => {
      const p = setup({ paths: { n1: poly('M 0 0 L 100 0 L 100 100') } });
      p.click(102, 97);
      expect(p.scratch.current!.anchors.map((a) => [a.x, a.y])).toEqual([[0, 0], [100, 0], [100, 100]]);
      p.click(200, 100);
      p.enter();
      expect(p.adapter.addNode).not.toHaveBeenCalled();
      expect(p.applyEdit).toHaveBeenCalledOnce();
      expect(p.applyEdit.mock.calls[0][0]).toBe('n1');
      expect(pointsOf(p.scene.n1)).toEqual([[[0, 0], [100, 0], [100, 100], [200, 100]]]);
      expect(p.adapter.setSelection).toHaveBeenCalledWith(['n1']);
      expect(p.scratch.current).toBeNull();
    });

    it('pressing the first anchor prepends, keeping the path running the way it did', () => {
      const p = setup({ paths: { n1: poly('M 0 0 C 30 0 70 0 100 0 L 100 100') } });
      p.click(1, 1);
      p.click(-50, 0);
      p.enter();
      const { anchors } = pathToAnchors(p.scene.n1);
      expect(anchors[0].map((a) => [a.x, a.y])).toEqual([[-50, 0], [0, 0], [100, 0], [100, 100]]);
      // The curve survives both reversals unchanged.
      expect(anchors[0][1].outHandle).toEqual({ x: 30, y: 0 });
      expect(anchors[0][2].inHandle).toEqual({ x: 70, y: 0 });
      // The edit says where each point came from, for arrays kept per point: the new end
      // takes after the end it was drawn from.
      expect(remapPointValues([0, 1, 2, 3, 4], (p.applyEdit.mock.calls[0] as unknown[])[3] as never)).toEqual([0, 0, 1, 2, 3, 4]);
    });

    it('clicking the far end closes the continued path onto itself', () => {
      const p = setup({ paths: { n1: poly('M 0 0 L 100 0') } });
      p.click(100, 0);
      p.click(100, 100);
      p.click(0, 1);
      expect(p.applyEdit).toHaveBeenCalledOnce();
      expect(Array.from(p.scene.n1.commands).at(-1)).toBe(4 /* Z */);
      expect(pointsOf(p.scene.n1)).toEqual([[[0, 0], [100, 0], [100, 100]]]);
    });

    it('leaves the node\'s other subpaths and fill rule alone', () => {
      const original = { ...poly('M 0 0 L 10 0 L 10 10 Z M 50 50 L 60 50'), fillRule: 'evenodd' as const };
      const p = setup({ paths: { n1: original } });
      p.click(60, 50);
      p.click(60, 60);
      p.enter();
      expect(pointsOf(p.scene.n1)).toEqual([[[0, 0], [10, 0], [10, 10]], [[50, 50], [60, 50], [60, 60]]]);
      expect(pathToAnchors(p.scene.n1).closed).toEqual([true, false]);
      expect(p.scene.n1.fillRule).toBe('evenodd');
    });

    it('finishing without adding anything writes nothing', () => {
      const p = setup({ paths: { n1: poly('M 0 0 L 100 0') } });
      p.click(100, 0);
      p.enter();
      expect(p.applyEdit).not.toHaveBeenCalled();
      expect(p.adapter.addNode).not.toHaveBeenCalled();
      expect(p.scratch.current).toBeNull();
    });

    it('Escape drops the pick-up without touching the node', () => {
      const p = setup({ paths: { n1: poly('M 0 0 L 100 0') } });
      p.click(100, 0);
      p.click(200, 0);
      p.escape();
      expect(p.applyEdit).not.toHaveBeenCalled();
      p.click(300, 300);
      p.click(400, 300);
      p.enter();
      // The next path is a new node, not a continuation.
      expect(p.adapter.addNode).toHaveBeenCalledOnce();
      expect(p.applyEdit).not.toHaveBeenCalled();
    });

    it('dragging from the endpoint picks the path up and pulls that anchor\'s handle', () => {
      const p = setup({ paths: { n1: poly('M 0 0 L 100 0') } });
      p.drag({ x: 100, y: 0 }, { x: 150, y: 0 });
      expect(p.scratch.current!.anchors).toHaveLength(2);
      expect(p.scratch.current!.anchors[1].outHandle).toEqual({ x: 150, y: 0 });
      p.click(200, 50);
      p.enter();
      expect(p.applyEdit).toHaveBeenCalledOnce();
      const [sub] = pathToAnchors(p.scene.n1).anchors;
      expect(sub.map((a) => [a.x, a.y])).toEqual([[0, 0], [100, 0], [200, 50]]);
      expect(sub[1].outHandle).toEqual({ x: 150, y: 0 });
    });

    it('only picks up from idle — mid-path, an endpoint press is not a pick-up', () => {
      // Without `makeNode` the press cannot join either (see "joining onto
      // another open path"), which leaves only the pick-up to rule out.
      const p = setup({ noMakeNode: true, paths: { n1: poly('M 0 0 L 100 0') } });
      p.click(300, 300);
      p.click(100, 0);
      expect(p.scratch.continuing).toBeNull();
      p.enter();
      expect(p.applyEdit).not.toHaveBeenCalled();
      expect(p.adapter.addNode).toHaveBeenCalledOnce();
    });

    it('ignores closed subpaths and interior anchors', () => {
      const p = setup({ paths: { n1: poly('M 0 0 L 100 0 L 100 100 Z'), n2: poly('M 200 0 L 300 0 L 300 100') } });
      p.click(0, 0);
      expect(p.scratch.current!.anchors).toHaveLength(1);
      p.escape();
      p.click(300, 0);
      expect(p.scratch.current!.anchors).toHaveLength(1);
    });

    it('finds a kit path node through the real area query', () => {
      // The shape the kit's own pen commits: a rect pose over a pose-local
      // `data.path`, stroked, no fill.
      const node = {
        id: 'k', kind: 'mark' as const, layer: 'default', parent: null,
        pose: { x: 40, y: 40, width: 100, height: 50 },
        data: { path: poly('M 0 0 L 100 0 L 100 50'), fill: null, stroke: { color: '#000', width: 2 } },
      };
      const scene = {
        layers: [{ id: 'default' }],
        renderOrder: () => ['k'],
        renderOrderNodes: () => [node],
        composition: IDENTITY_POSE_COMPOSITION,
        get: (id: string) => (id === 'k' ? node : undefined),
        overrides: { read: () => undefined },
      } as unknown as Scene<unknown, string, unknown>;
      const applyEdit = vi.fn();
      const p = setup({
        deps: {
          areaSelect: { hitTestArea: (b: Parameters<typeof hitTestArea>[1]) => hitTestArea(scene, b) },
          editAnchors: { getEditablePath: (id: string) => resolveEditablePathOf(scene.get(id as never) as never), applyEdit },
        },
      });
      p.click(143, 88);
      expect(p.scratch.current!.anchors.map((a) => [a.x, a.y])).toEqual([[40, 40], [140, 40], [140, 90]]);
      p.click(200, 90);
      p.enter();
      expect(applyEdit).toHaveBeenCalledOnce();
      expect(applyEdit.mock.calls[0][0]).toBe('k');
    });

    it('the pick-up radius is screen px, like the close radius', () => {
      const p = setup({ scale: 4, paths: { n1: poly('M 0 0 L 100 0') } });
      // 3 world units at 4x is 12 screen px — outside the default 8.
      p.click(103, 0);
      expect(p.scratch.current!.anchors).toHaveLength(1);
      p.escape();
      p.click(101, 0);
      expect(p.scratch.current!.anchors).toHaveLength(2);
    });
  });
});
