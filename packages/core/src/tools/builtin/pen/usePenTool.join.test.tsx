import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { type PolygonPath, pathFromD } from '@weasel-js/geom';
import { pathToAnchors } from '@weasel-js/geom';
import { hitTestArea } from 'canvas/deps/hitTestArea';
import { resolveEditablePathOf, useEditAnchorsDepSource } from 'canvas/deps/editAnchors';
import type { Scene } from 'core/scene/types';
import { DepRegistryProvider, useDepRegistry, type DepRegistry } from '@weasel-js/routing/react';
import { createScene } from 'core/scene/scene';
import { asNodeId, type RectPose } from 'core/scene/types';
import type { SelectionApi } from 'core/selection/useSelection';
import { defaultCommitAdapter } from 'interactions/actions/defaultCommitAdapter';
import { setup } from './testing/penHarness';

// The real layer, recorded: the pen keeps its state to itself, and the one
// place it hands that object out is to the preview layer that paints from it.
vi.mock('domains/paths/penPreviewLayer', async (importOriginal) => {
  const actual = await importOriginal<typeof import('domains/paths/penPreviewLayer')>();
  return { ...actual, createPenPreviewLayer: vi.fn(actual.createPenPreviewLayer) };
});

describe('usePenTool', () => {
  describe('joining onto another open path', () => {
    const poly = (d: string) => pathFromD(d) as PolygonPath;
    const pointsOf = (path: unknown) =>
      pathToAnchors(path as PolygonPath).anchors.map((sub) => sub.map((a) => [a.x, a.y]));

    it('a new path ending on another path\'s first anchor becomes one node, and the other is deleted', () => {
      const p = setup({ paths: { b: poly('M 0 0 L 100 0 L 100 100') } });
      p.click(0, 200);
      p.click(0, 100);
      p.click(1, 1);
      expect(p.applyOps).toHaveBeenCalledOnce();
      expect(p.applyOps.mock.calls[0][1]).toBe('Join paths');
      expect(p.adapter.addNode).not.toHaveBeenCalled();
      expect(p.inserted).toHaveLength(1);
      expect(pointsOf(p.inserted[0].pose.path)).toEqual([[[0, 200], [0, 100], [0, 0], [100, 0], [100, 100]]]);
      expect(p.inserted[0].pose.closed).toBe(false);
      expect(p.scene.b).toBeUndefined();
      expect(p.adapter.setSelection).toHaveBeenCalledWith([p.inserted[0].id]);
      expect(p.scratch.current).toBeNull();
    });

    it('ending on the other path\'s last anchor turns it around, swapping each anchor\'s handles', () => {
      const p = setup({ paths: { b: poly('M 0 0 C 30 0 70 0 100 0 L 100 100') } });
      p.click(200, 200);
      p.click(100, 101);
      const [sub] = pathToAnchors(p.inserted[0].pose.path).anchors;
      expect(sub.map((a) => [a.x, a.y])).toEqual([[200, 200], [100, 100], [100, 0], [0, 0]]);
      expect(sub[2].outHandle).toEqual({ x: 70, y: 0 });
      expect(sub[3].inHandle).toEqual({ x: 30, y: 0 });
      expect(p.scene.b).toBeUndefined();
    });

    it('keeps the other path\'s handle leaving the joined anchor', () => {
      const p = setup({ paths: { b: poly('M 0 0 C 0 -50 100 -50 100 0') } });
      p.click(-100, 0);
      p.click(1, 0);
      const [sub] = pathToAnchors(p.inserted[0].pose.path).anchors;
      expect(sub.map((a) => [a.x, a.y])).toEqual([[-100, 0], [0, 0], [100, 0]]);
      expect(sub[1].outHandle).toEqual({ x: 0, y: -50 });
      expect(sub[2].inHandle).toEqual({ x: 100, y: -50 });
    });

    it('dragging on the endpoint joins, and the dragged handle leaves the joined anchor', () => {
      const p = setup({ paths: { b: poly('M 0 0 L 100 0') } });
      p.click(-100, 0);
      p.drag({ x: 1, y: 0 }, { x: 30, y: 30 });
      expect(p.applyOps).toHaveBeenCalledOnce();
      const [sub] = pathToAnchors(p.inserted[0].pose.path).anchors;
      expect(sub.map((a) => [a.x, a.y])).toEqual([[-100, 0], [0, 0], [100, 0]]);
      expect(sub[1].outHandle).toEqual({ x: 30, y: 30 });
      expect(p.scene.b).toBeUndefined();
    });

    it('a continued path keeps its node: the other path\'s anchors join it and the other node goes', () => {
      const p = setup({ paths: { a: poly('M 0 0 L 100 0'), b: poly('M 300 0 L 400 0') } });
      p.click(100, 0);
      p.click(200, 50);
      p.click(300, 1);
      expect(p.applyOps).toHaveBeenCalledOnce();
      expect(p.editOps.mock.calls[0][0]).toBe('a');
      expect(p.applyEdit).not.toHaveBeenCalled();
      expect(p.adapter.addNode).not.toHaveBeenCalled();
      expect(p.inserted).toEqual([]);
      expect(pointsOf(p.scene.a)).toEqual([[[0, 0], [100, 0], [200, 50], [300, 0], [400, 0]]]);
      expect(p.scene.b).toBeUndefined();
      expect(p.adapter.setSelection).toHaveBeenCalledWith(['a']);
    });

    it('a path continued from its first anchor keeps its direction through the join', () => {
      const p = setup({ paths: { a: poly('M 0 0 L 100 0'), b: poly('M -300 0 L -200 0') } });
      p.click(0, 0);
      p.click(-100, 50);
      p.click(-200, 1);
      expect(pointsOf(p.scene.a)).toEqual([[[-300, 0], [-200, 0], [-100, 50], [0, 0], [100, 0]]]);
      expect(p.scene.b).toBeUndefined();
    });

    it('joins two subpaths of the continued node without deleting it', () => {
      const p = setup({ paths: { a: poly('M 0 0 L 100 0 M 300 0 L 400 0') } });
      p.click(100, 0);
      p.click(200, 50);
      p.click(300, 0);
      expect(pointsOf(p.scene.a)).toEqual([[[0, 0], [100, 0], [200, 50], [300, 0], [400, 0]]]);
    });

    it('never joins a path onto itself — its own far end is a close, or just an anchor', () => {
      const p = setup({ paths: { a: poly('M 0 0 L 100 0') } });
      p.click(100, 0);
      p.click(0, 1);
      expect(p.applyOps).not.toHaveBeenCalled();
      expect(p.scratch.current!.anchors.map((a) => [a.x, a.y])).toEqual([[0, 0], [100, 0], [0, 0]]);
    });

    it('brings the other node\'s remaining subpaths along', () => {
      const p = setup({ paths: { b: poly('M 0 0 L 100 0 M 500 500 L 600 500 L 600 600 Z') } });
      p.click(-100, 0);
      p.click(0, 0);
      const { anchors, closed } = pathToAnchors(p.inserted[0].pose.path);
      expect(anchors.map((sub) => sub.map((a) => [a.x, a.y]))).toEqual([
        [[-100, 0], [0, 0], [100, 0]],
        [[500, 500], [600, 500], [600, 600]],
      ]);
      expect(closed).toEqual([false, true]);
    });

    it('an interior anchor is only a snap target, not a join', () => {
      const p = setup({ paths: { b: poly('M 0 0 L 100 0 L 200 0') } });
      p.click(100, 100);
      p.click(100, 1);
      expect(p.applyOps).not.toHaveBeenCalled();
      expect(p.scratch.current!.anchors).toHaveLength(2);
    });

    it('without makeNode a new path cannot join in one batch, so the anchor just lands', () => {
      const p = setup({ noMakeNode: true, paths: { b: poly('M 0 0 L 100 0') } });
      p.click(-100, 0);
      p.click(0, 1);
      expect(p.applyOps).not.toHaveBeenCalled();
      expect(p.scene.b).toBeDefined();
      expect(p.scratch.current!.anchors).toHaveLength(2);
    });

    it('without editOps a continued path cannot join in one batch, so the anchor just lands', () => {
      const paths: Record<string, PolygonPath> = { a: poly('M 0 0 L 100 0'), b: poly('M 300 0 L 400 0') };
      const p = setup({
        paths,
        deps: { editAnchors: { getEditablePath: (id: string) => paths[id] ?? null, applyEdit: vi.fn() } },
      });
      p.click(100, 0);
      p.click(300, 1);
      expect(p.applyOps).not.toHaveBeenCalled();
      expect(p.scene.b).toBeDefined();
      expect(p.scratch.current!.anchors).toHaveLength(3);
    });
  });

  describe('joining against a real scene', () => {
    const poly = (d: string) => pathFromD(d) as PolygonPath;
    type Leaf = { path: PolygonPath; fill: null; stroke: string };
    type AnyScene = Scene<unknown, string, unknown>;

    function realScene(): AnyScene {
      const scene = createScene<Leaf, 'default', RectPose & { rotation?: number }>({ systemLayers: [{ id: 'default' }] });
      // A: a pose-local path under a plain translation.
      scene.add({ id: asNodeId('a'), kind: 'mark', layer: 'default', pose: { x: 40, y: 40, width: 100, height: 0 }, data: { path: poly('M 0 0 L 100 0'), fill: null, stroke: 'red' } });
      // B: the same local path under a quarter turn about its AABB center
      // (350, 300), which puts it on world (350, 250)..(350, 350).
      scene.add({ id: asNodeId('b'), kind: 'mark', layer: 'default', pose: { x: 300, y: 300, width: 100, height: 0, rotation: Math.PI / 2 }, data: { path: poly('M 0 0 L 100 0'), fill: null, stroke: 'blue' } });
      return scene as unknown as AnyScene;
    }

    function wire(scene: AnyScene) {
      let reg!: DepRegistry;
      function Wire() {
        useEditAnchorsDepSource(scene, { current: [], set: () => {} } as unknown as SelectionApi, {
          applyOps: (ops, label) => scene.applyBatch(ops, label ?? '', defaultCommitAdapter(scene)),
        });
        reg = useDepRegistry();
        return null;
      }
      render(<DepRegistryProvider><Wire /></DepRegistryProvider>);
      return {
        areaSelect: { hitTestArea: (b: Parameters<typeof hitTestArea>[1]) => hitTestArea(scene, b) },
        editAnchors: (reg.get as (k: string) => unknown)('editAnchors'),
        scene,
        applyOps: undefined,
      };
    }

    const worldPoints = (scene: AnyScene, id: string) =>
      pathToAnchors(resolveEditablePathOf(scene.get(asNodeId(id)) as never)!).anchors
        .map((sub) => sub.map((a) => [Math.round(a.x), Math.round(a.y)]));

    it('joins in world space across different pose frames, as one undo step', () => {
      const scene = realScene();
      expect(worldPoints(scene, 'b')).toEqual([[[350, 250], [350, 350]]]);
      const p = setup({ deps: wire(scene) });
      const entriesBefore = scene.historyEntries().length;
      p.click(140, 40);
      p.click(250, 150);
      p.click(351, 251);
      expect(scene.get(asNodeId('b'))).toBeUndefined();
      expect((scene.get(asNodeId('a'))!.data as Leaf).stroke).toBe('red');
      expect(worldPoints(scene, 'a')).toEqual([[[40, 40], [140, 40], [250, 150], [350, 250], [350, 350]]]);
      expect(scene.historyEntries().length).toBe(entriesBefore + 1);
      scene.undo();
      expect(worldPoints(scene, 'a')).toEqual([[[40, 40], [140, 40]]]);
      expect(worldPoints(scene, 'b')).toEqual([[[350, 250], [350, 350]]]);
    });
  });
});
