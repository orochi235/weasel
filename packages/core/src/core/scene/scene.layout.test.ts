import { describe, expect, it, vi } from 'vitest';
import { createScene, sceneFromJSON } from './scene';
import { asNodeId } from './types';
import type { NodeId, RectPose } from './types';
import type { LayoutStrategy } from '../../layout/types';
import { createTransformOp } from 'core/ops/transform';

/** Children stacked top to bottom in child order, each 10 tall and as wide as
 *  the container. */
function stack(): LayoutStrategy<RectPose> {
  return {
    snap: { pickTarget: () => null },
    childPoses(container, children) {
      const out = new Map<string, RectPose>();
      children.forEach((c, i) => {
        out.set(c.id, {
          x: container.bounds.x,
          y: container.bounds.y + i * 10,
          width: container.bounds.width,
          height: 10,
        });
      });
      return out;
    },
    getDropTargets: () => [],
    reflowPoses: () => new Map(),
    commitDrop: () => [],
  };
}

const C = asNodeId('C');
/** Children stored relative to their container's corner. */
const TRANSLATE = {
  compose: (p: RectPose, c: RectPose) => ({ ...c, x: p.x + c.x, y: p.y + c.y }),
  decompose: (p: RectPose, w: RectPose) => ({ ...w, x: w.x - p.x, y: w.y - p.y }),
  closure: 'translation' as const,
};
const CONTAINER: RectPose = { x: 100, y: 100, width: 50, height: 200 };
const LOOSE: RectPose = { x: 0, y: 0, width: 5, height: 5 };

function makeScene(layout: LayoutStrategy<RectPose> = stack()) {
  const scene = createScene<null, 'l', RectPose>({
    systemLayers: [{ id: 'l' }],
    initial: [{ id: C, kind: 'container', layer: 'l', pose: CONTAINER, data: null, layout }],
  });
  return scene;
}

function add(scene: ReturnType<typeof makeScene>, id: string, index?: number): NodeId {
  return scene.add({
    id: asNodeId(id), kind: 'leaf', layer: 'l', pose: LOOSE, data: null, parent: C,
    ...(index !== undefined ? { index } : {}),
  });
}

const posOf = (scene: ReturnType<typeof makeScene>, id: string) => {
  const p = scene.get(asNodeId(id))!.pose;
  return [p.x, p.y];
};

describe('scene container layout', () => {
  it('reads a container its declared layout, and a leaf none', () => {
    const layout = stack();
    const scene = makeScene(layout);
    add(scene, 'a');
    expect(scene.layoutOf(C)).toBe(layout);
    expect(scene.layoutOf(asNodeId('a'))).toBeNull();
  });

  it('lays out an inserted child, and one undo takes both back', () => {
    const scene = makeScene();
    add(scene, 'a');
    add(scene, 'b');
    expect(posOf(scene, 'a')).toEqual([100, 100]);
    expect(posOf(scene, 'b')).toEqual([100, 110]);
    expect(scene.historyIndex()).toBe(2);

    add(scene, 'c', 0);
    expect(posOf(scene, 'c')).toEqual([100, 100]);
    expect(posOf(scene, 'a')).toEqual([100, 110]);
    expect(posOf(scene, 'b')).toEqual([100, 120]);
    expect(scene.historyIndex()).toBe(3);

    scene.undo();
    expect(scene.get(asNodeId('c'))).toBeUndefined();
    expect(posOf(scene, 'a')).toEqual([100, 100]);
    expect(posOf(scene, 'b')).toEqual([100, 110]);

    scene.redo();
    expect(posOf(scene, 'c')).toEqual([100, 100]);
    expect(posOf(scene, 'b')).toEqual([100, 120]);
  });

  it('closes the gap a deleted child leaves, as one undo step', () => {
    const scene = makeScene();
    add(scene, 'a');
    add(scene, 'b');
    add(scene, 'c');
    const depth = scene.historyIndex();

    scene.remove(asNodeId('a'));
    expect(posOf(scene, 'b')).toEqual([100, 100]);
    expect(posOf(scene, 'c')).toEqual([100, 110]);
    expect(scene.historyIndex()).toBe(depth + 1);

    scene.undo();
    expect(posOf(scene, 'a')).toEqual([100, 100]);
    expect(posOf(scene, 'b')).toEqual([100, 110]);
    expect(posOf(scene, 'c')).toEqual([100, 120]);
  });

  it('re-applies on a reorder, as one undo step', () => {
    const scene = makeScene();
    add(scene, 'a');
    add(scene, 'b');
    const depth = scene.historyIndex();

    scene.reorder(asNodeId('b'), 0);
    expect(posOf(scene, 'b')).toEqual([100, 100]);
    expect(posOf(scene, 'a')).toEqual([100, 110]);
    expect(scene.historyIndex()).toBe(depth + 1);

    scene.undo();
    expect(posOf(scene, 'a')).toEqual([100, 100]);
    expect(posOf(scene, 'b')).toEqual([100, 110]);
  });

  it('re-applies when the container is resized, as one undo step', () => {
    const scene = makeScene();
    add(scene, 'a');
    const depth = scene.historyIndex();

    scene.setPose(C, { ...CONTAINER, width: 80 });
    expect(scene.get(asNodeId('a'))!.pose.width).toBe(80);
    expect(scene.historyIndex()).toBe(depth + 1);

    scene.undo();
    expect(scene.get(C)!.pose.width).toBe(50);
    expect(scene.get(asNodeId('a'))!.pose.width).toBe(50);
  });

  it('leaves the children alone when the container only moves', () => {
    const scene = makeScene();
    add(scene, 'a');
    scene.setPose(C, { ...CONTAINER, x: 300 });
    expect(posOf(scene, 'a')).toEqual([100, 100]);
  });

  it('lays out through applyBatch and scene.batch, in the same entry', () => {
    const scene = makeScene();
    add(scene, 'a');
    add(scene, 'b');
    const depth = scene.historyIndex();
    const adapter = {
      setPose: (id: string, pose: RectPose) => scene.setPose(asNodeId(id), pose),
    };
    scene.applyBatch(
      [createTransformOp<RectPose>({ id: C as string, from: CONTAINER, to: { ...CONTAINER, width: 70 } })],
      'resize',
      adapter,
    );
    expect(scene.get(asNodeId('b'))!.pose.width).toBe(70);
    expect(scene.historyIndex()).toBe(depth + 1);

    scene.batch('two', () => {
      scene.remove(asNodeId('a'));
      add(scene, 'c');
    });
    expect(posOf(scene, 'b')).toEqual([100, 100]);
    expect(posOf(scene, 'c')).toEqual([100, 110]);
    expect(scene.historyIndex()).toBe(depth + 2);

    scene.undo();
    expect(posOf(scene, 'a')).toEqual([100, 100]);
    expect(posOf(scene, 'b')).toEqual([100, 110]);
    scene.undo();
    expect(scene.get(asNodeId('b'))!.pose.width).toBe(50);
  });

  it('reports each forward reflow with where the child was, and never an undo', () => {
    const scene = makeScene();
    const seen: { id: string; from: RectPose; to: RectPose }[][] = [];
    const off = scene.onReflow((moves) => seen.push(moves.map((m) => ({ ...m }))));
    add(scene, 'a');
    expect(seen).toEqual([[{ id: 'a', from: LOOSE, to: { x: 100, y: 100, width: 50, height: 10 } }]]);
    scene.undo();
    scene.redo();
    expect(seen).toHaveLength(1);
    off();
    add(scene, 'b');
    expect(seen).toHaveLength(1);
  });

  it('reflows a nested laid-out container its parent resized, and stops', () => {
    const scene = makeScene();
    const inner = asNodeId('inner');
    scene.add({
      id: inner, kind: 'container', layer: 'l', pose: LOOSE, data: null, parent: C, layout: stack(),
    });
    scene.add({ id: asNodeId('x'), kind: 'leaf', layer: 'l', pose: LOOSE, data: null, parent: inner });
    // The inner container took the parent's row; its child took the inner's.
    expect(scene.get(inner)!.pose).toEqual({ x: 100, y: 100, width: 50, height: 10 });
    expect(scene.get(asNodeId('x'))!.pose).toEqual({ x: 100, y: 100, width: 50, height: 10 });
    scene.setPose(C, { ...CONTAINER, width: 90 });
    expect(scene.get(asNodeId('x'))!.pose.width).toBe(90);
  });

  it('survives a strategy that never settles', () => {
    let n = 0;
    const restless: LayoutStrategy<RectPose> = {
      ...stack(),
      childPoses(_c, children) {
        return new Map(children.map((c) => [c.id, { x: n++, y: 0, width: 5, height: 5 }]));
      },
    };
    const scene = makeScene(restless);
    add(scene, 'a');
    expect(scene.historyIndex()).toBe(1);
  });

  it('lays out in world and writes local poses under a composing frame', () => {
    const scene = createScene<null, 'l', RectPose>({
      systemLayers: [{ id: 'l' }],
      layoutFrame: { composition: TRANSLATE },
      initial: [{ id: C, kind: 'container', layer: 'l', pose: CONTAINER, data: null, layout: stack() }],
    });
    add(scene as ReturnType<typeof makeScene>, 'a');
    add(scene as ReturnType<typeof makeScene>, 'b');
    expect(scene.get(asNodeId('b'))!.pose).toEqual({ x: 0, y: 10, width: 50, height: 10 });
  });

  it('round-trips a registered layout through toJSON', () => {
    const layout = stack();
    const scene = createScene<null, 'l', RectPose>({
      systemLayers: [{ id: 'l' }],
      registry: { layout: { stack: layout } },
      initial: [{ id: C, kind: 'container', layer: 'l', pose: CONTAINER, data: null, layout }],
    });
    const json = scene.toJSON();
    expect(json.nodes[0].layoutKey).toBe('stack');
    const back = sceneFromJSON(json, { registry: { layout: { stack: layout } } });
    expect(back.layoutOf(C)).toBe(layout);
  });

  it('undoes a restored history\'s reflow without asking the layout again', () => {
    const layout = stack();
    const registry = { layout: { stack: layout } };
    const scene = createScene<null, 'l', RectPose>({
      systemLayers: [{ id: 'l' }],
      registry,
      initial: [{ id: C, kind: 'container', layer: 'l', pose: CONTAINER, data: null, layout }],
    });
    scene.add({ id: asNodeId('a'), kind: 'leaf', layer: 'l', pose: LOOSE, data: null, parent: C });
    scene.add({ id: asNodeId('b'), kind: 'leaf', layer: 'l', pose: LOOSE, data: null, parent: C });
    scene.remove(asNodeId('a'));
    const saved = JSON.parse(JSON.stringify({ doc: scene.toJSON(), history: scene.serializeHistory() }));

    const back = sceneFromJSON(saved.doc, { registry });
    back.restoreHistory(saved.history);
    const childPoses = vi.spyOn(layout, 'childPoses');
    back.undo();
    expect(back.get(asNodeId('a'))!.pose.y).toBe(100);
    expect(back.get(asNodeId('b'))!.pose.y).toBe(110);
    expect(childPoses).not.toHaveBeenCalled();
  });

  it('brings a removed container back with its layout', () => {
    const scene = makeScene();
    scene.remove(C);
    scene.undo();
    add(scene, 'a');
    expect(posOf(scene, 'a')).toEqual([100, 100]);
  });

  it('leaves a scene without layouts recording what it did before', () => {
    const scene = createScene<null, 'l', RectPose>({ systemLayers: [{ id: 'l' }] });
    const spy = vi.fn();
    scene.onReflow(spy);
    const id = scene.add({ kind: 'leaf', layer: 'l', pose: LOOSE, data: null });
    scene.setPose(id, { ...LOOSE, x: 3 });
    expect(scene.history.entries().undo.map((e) => e.label)).toEqual(['add leaf', 'setPose']);
    expect(spy).not.toHaveBeenCalled();
  });
});
