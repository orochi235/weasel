import { describe, expect, it, vi } from 'vitest';
import { createScene, sceneFromJSON } from './scene';
import { RIGID_POSE_COMPOSITION, composeWorldPose } from './composePose';
import { scenePoseAdapter } from './scenePoseAdapter';
import { asNodeId } from './types';
import type { NodeId, RectPose } from './types';
import type { LayoutStrategy } from '../../layout/types';
import { createTransformOp } from 'core/ops/transform';
import { createSetLayoutOp } from 'core/ops/setLayout';
import { rebuildOp } from 'core/ops/registry';

/** Children side by side left to right in child order, each 10 wide. */
function row(): LayoutStrategy<RectPose> {
  return {
    ...stack(),
    childPoses(container, children) {
      return new Map(children.map((c, i) => [c.id, {
        x: container.bounds.x + i * 10, y: container.bounds.y, width: 10, height: container.bounds.height,
      }]));
    },
  };
}

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
    initial: [{ id: C, kind: 'group', layer: 'l', pose: CONTAINER, data: null, layout }],
  });
  return scene;
}

function add(scene: ReturnType<typeof makeScene>, id: string, index?: number): NodeId {
  return scene.add({
    id: asNodeId(id), kind: 'mark', layer: 'l', pose: LOOSE, data: null, parent: C,
    ...(index !== undefined ? { index } : {}),
  });
}

/** Where `id` is in world: a child's stored pose is in its container's frame. */
const posOf = (scene: { composition: { compose: unknown } }, id: string) => {
  const p = composeWorldPose(scenePoseAdapter(scene as never), id, scene.composition.compose as never) as RectPose;
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

  it('hands children that left to depart, which may resize the container in the same step', () => {
    const seen: string[][] = [];
    const base = stack();
    const hugging: LayoutStrategy<RectPose> = {
      ...base,
      depart(container, children, departed) {
        seen.push([...departed]);
        return {
          poses: base.childPoses(container, children),
          bounds: { ...container.bounds, height: children.length * 10 },
        };
      },
    };
    const scene = makeScene(hugging);
    add(scene, 'a');
    add(scene, 'b');
    add(scene, 'c');
    const depth = scene.historyIndex();

    scene.remove(asNodeId('a'));
    expect(seen).toEqual([['a']]);
    expect(scene.get(C)!.pose.height).toBe(20);
    expect(posOf(scene, 'b')).toEqual([100, 100]);
    expect(scene.historyIndex()).toBe(depth + 1);

    scene.move(asNodeId('b'), null);
    expect(seen).toEqual([['a'], ['b']]);
    expect(scene.get(C)!.pose.height).toBe(10);
    expect(posOf(scene, 'c')).toEqual([100, 100]);

    scene.undo();
    scene.undo();
    expect(scene.get(C)!.pose.height).toBe(200);
    expect(posOf(scene, 'c')).toEqual([100, 120]);
  });

  it('does not count a child that left and came back in one edit as departed', () => {
    const depart = vi.fn();
    const scene = makeScene({ ...stack(), depart });
    add(scene, 'a');
    add(scene, 'b');
    scene.batch('round trip', () => {
      scene.move(asNodeId('a'), null);
      scene.move(asNodeId('a'), C);
    });
    expect(depart).not.toHaveBeenCalled();
  });

  it('arranges the arrivals of an edit after its departures', () => {
    const order: string[] = [];
    const base = stack();
    const scene = makeScene({
      ...base,
      depart(container, children) {
        order.push(`depart:${children.map((c) => c.id).join(',')}`);
        return { poses: base.childPoses(container, children) };
      },
      arrive(container, children) {
        order.push(`arrive:${children.map((c) => c.id).join(',')}`);
        return { poses: base.childPoses(container, children) };
      },
    });
    add(scene, 'a');
    add(scene, 'b');
    order.length = 0;
    scene.batch('swap', () => {
      scene.remove(asNodeId('a'));
      add(scene, 'c');
    });
    expect(order).toEqual(['depart:b', 'arrive:b,c']);
    expect(posOf(scene, 'c')).toEqual([100, 110]);
  });

  it('carries the children in its frame when the container only moves, writing none of them', () => {
    const scene = makeScene();
    add(scene, 'a');
    const stored = scene.get(asNodeId('a'))!.pose;
    scene.setPose(C, { ...CONTAINER, x: 300 });
    expect(posOf(scene, 'a')).toEqual([300, 100]);
    expect(scene.get(asNodeId('a'))!.pose).toBe(stored);
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

  it('coalesces a live resize that re-arranges the same children each frame', () => {
    const scene = createScene<null, 'l', RectPose>({
      systemLayers: [{ id: 'l' }],
      initial: [{ id: C, kind: 'group', layer: 'l', pose: CONTAINER, data: null, layout: stack() }],
      coalesceWindowMs: 500,
    });
    add(scene, 'a');
    add(scene, 'b');
    const depth = scene.historyIndex();
    const adapter = { setPose: (id: string, pose: RectPose) => scene.setPose(asNodeId(id), pose) };
    const resize = (from: number, to: number) => scene.applyBatch(
      [createTransformOp<RectPose>({ id: C as string, from: { ...CONTAINER, width: from }, to: { ...CONTAINER, width: to } })],
      'resize',
      adapter,
    );
    resize(50, 60);
    resize(60, 70);
    expect(scene.historyIndex()).toBe(depth + 1);
    expect(scene.get(asNodeId('b'))!.pose.width).toBe(70);

    scene.undo();
    expect(scene.get(C)!.pose.width).toBe(50);
    expect(scene.get(asNodeId('b'))!.pose.width).toBe(50);
  });

  it('reports each forward reflow with where the child was, and never an undo', () => {
    const scene = makeScene();
    const seen: { id: string; from: RectPose; to: RectPose }[][] = [];
    const off = scene.onReflow((moves) => seen.push(moves.map((m) => ({ ...m }))));
    add(scene, 'a');
    // Stored poses, in the container's frame.
    expect(seen).toEqual([[{ id: 'a', from: LOOSE, to: { x: 0, y: 0, width: 50, height: 10 } }]]);
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
      id: inner, kind: 'group', layer: 'l', pose: LOOSE, data: null, parent: C, layout: stack(),
    });
    scene.add({ id: asNodeId('x'), kind: 'mark', layer: 'l', pose: LOOSE, data: null, parent: inner });
    // The inner container took the parent's row; its child took the inner's.
    expect(scene.get(inner)!.pose).toEqual({ x: 0, y: 0, width: 50, height: 10 });
    expect(scene.get(asNodeId('x'))!.pose).toEqual({ x: 0, y: 0, width: 50, height: 10 });
    expect(posOf(scene, 'x')).toEqual([100, 100]);
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
      composition: TRANSLATE,
      initial: [{ id: C, kind: 'group', layer: 'l', pose: CONTAINER, data: null, layout: stack() }],
    });
    add(scene as ReturnType<typeof makeScene>, 'a');
    add(scene as ReturnType<typeof makeScene>, 'b');
    expect(scene.get(asNodeId('b'))!.pose).toEqual({ x: 0, y: 10, width: 50, height: 10 });
    expect(scene.composition).toBe(TRANSLATE);
  });

  it('composes rigidly when no composition is given', () => {
    expect(makeScene(stack()).composition).toBe(RIGID_POSE_COMPOSITION);
  });

  it('round-trips a registered layout through toJSON', () => {
    const layout = stack();
    const scene = createScene<null, 'l', RectPose>({
      systemLayers: [{ id: 'l' }],
      registry: { layout: { stack: layout } },
      initial: [{ id: C, kind: 'group', layer: 'l', pose: CONTAINER, data: null, layout }],
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
      initial: [{ id: C, kind: 'group', layer: 'l', pose: CONTAINER, data: null, layout }],
    });
    scene.add({ id: asNodeId('a'), kind: 'mark', layer: 'l', pose: LOOSE, data: null, parent: C });
    scene.add({ id: asNodeId('b'), kind: 'mark', layer: 'l', pose: LOOSE, data: null, parent: C });
    scene.remove(asNodeId('a'));
    const saved = JSON.parse(JSON.stringify({ doc: scene.toJSON(), history: scene.serializeHistory() }));

    const back = sceneFromJSON(saved.doc, { registry });
    back.restoreHistory(saved.history);
    const childPoses = vi.spyOn(layout, 'childPoses');
    back.undo();
    expect(posOf(back, 'a')).toEqual([100, 100]);
    expect(posOf(back, 'b')).toEqual([100, 110]);
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
    const id = scene.add({ kind: 'mark', layer: 'l', pose: LOOSE, data: null });
    scene.setPose(id, { ...LOOSE, x: 3 });
    expect(scene.history.entries().undo.map((e) => e.label)).toEqual(['add mark', 'setPose']);
    expect(spy).not.toHaveBeenCalled();
  });

  describe('setLayout', () => {
    it('swaps the layout and re-arranges under it, as one undo step', () => {
      const first = stack();
      const second = row();
      const scene = makeScene(first);
      add(scene, 'a');
      add(scene, 'b');
      const depth = scene.historyIndex();

      scene.setLayout(C, second);
      expect(scene.layoutOf(C)).toBe(second);
      expect(posOf(scene, 'b')).toEqual([110, 100]);
      expect(scene.historyIndex()).toBe(depth + 1);

      scene.undo();
      expect(scene.layoutOf(C)).toBe(first);
      expect(posOf(scene, 'b')).toEqual([100, 110]);
      scene.redo();
      expect(scene.layoutOf(C)).toBe(second);
      expect(posOf(scene, 'b')).toEqual([110, 100]);
    });

    it('lays out a container in a scene that had no layout before', () => {
      const scene = createScene<null, 'l', RectPose>({
        systemLayers: [{ id: 'l' }],
        initial: [{ id: C, kind: 'group', layer: 'l', pose: CONTAINER, data: null }],
      });
      scene.add({ id: asNodeId('a'), kind: 'mark', layer: 'l', pose: LOOSE, data: null, parent: C });
      scene.setLayout(C, stack());
      expect(scene.get(asNodeId('a'))!.pose).toEqual({ x: 0, y: 0, width: 50, height: 10 });
      scene.undo();
      expect(scene.layoutOf(C)).toBeNull();
      expect(scene.get(asNodeId('a'))!.pose).toEqual(LOOSE);
    });

    it('clears a layout with null, leaving the children where they are', () => {
      const layout = stack();
      const scene = makeScene(layout);
      add(scene, 'a');
      scene.setLayout(C, null);
      expect(scene.layoutOf(C)).toBeNull();
      expect(posOf(scene, 'a')).toEqual([100, 100]);
      scene.setPose(C, { ...CONTAINER, width: 80 });
      expect(scene.get(asNodeId('a'))!.pose.width).toBe(50);
      scene.undo();
      scene.undo();
      expect(scene.layoutOf(C)).toBe(layout);
    });

    it('records nothing when the layout is already the one given', () => {
      const layout = stack();
      const scene = makeScene(layout);
      const depth = scene.historyIndex();
      scene.setLayout(C, layout);
      expect(scene.historyIndex()).toBe(depth);
    });

    it('stores the layout on a mark', () => {
      const scene = makeScene();
      add(scene, 'a');
      const layout = stack();
      scene.setLayout(asNodeId('a'), layout);
      expect(scene.layoutOf(asNodeId('a'))).toBe(layout);
    });

    it('names a registered layout by key, and a restored history undoes to it', () => {
      const first = stack();
      const second = row();
      const registry = { layout: { stack: first, row: second } };
      const scene = createScene<null, 'l', RectPose>({
        systemLayers: [{ id: 'l' }],
        registry,
        initial: [{ id: C, kind: 'group', layer: 'l', pose: CONTAINER, data: null, layout: first }],
      });
      scene.add({ id: asNodeId('a'), kind: 'mark', layer: 'l', pose: LOOSE, data: null, parent: C });
      scene.add({ id: asNodeId('b'), kind: 'mark', layer: 'l', pose: LOOSE, data: null, parent: C });
      scene.setLayout(C, 'row');
      expect(scene.layoutOf(C)).toBe(second);
      const saved = JSON.parse(JSON.stringify({ doc: scene.toJSON(), history: scene.serializeHistory() }));

      const back = sceneFromJSON(saved.doc, { registry });
      back.restoreHistory(saved.history);
      expect(back.layoutOf(C)).toBe(second);
      back.undo();
      expect(back.layoutOf(C)).toBe(first);
      expect(posOf(back, 'b')).toEqual([100, 110]);
      back.redo();
      expect(back.layoutOf(C)).toBe(second);
    });

    it('throws on a key the registry does not hold', () => {
      const scene = makeScene();
      expect(() => scene.setLayout(C, 'nope')).toThrow(/nope/);
    });

    it('is also an op, which applyBatch records with its arrangement', () => {
      const first = stack();
      const second = row();
      const scene = makeScene(first);
      add(scene, 'a');
      add(scene, 'b');
      const depth = scene.historyIndex();
      const adapter = {
        setLayout: (id: string, layout: LayoutStrategy<RectPose> | string | null) => scene.setLayout(asNodeId(id), layout),
        setPose: (id: string, pose: RectPose) => scene.setPose(asNodeId(id), pose),
      };
      scene.applyBatch([createSetLayoutOp({ id: C as string, from: first, to: second })], 'Relayout', adapter);
      expect(scene.layoutOf(C)).toBe(second);
      expect(posOf(scene, 'b')).toEqual([110, 100]);
      expect(scene.historyIndex()).toBe(depth + 1);
      scene.undo();
      expect(scene.layoutOf(C)).toBe(first);
      expect(posOf(scene, 'b')).toEqual([100, 110]);
    });

    describe('in a scene that has never had a layout', () => {
      function bare(registry?: { layout: Record<string, LayoutStrategy<RectPose>> }) {
        const scene = createScene<null, 'l', RectPose>({
          systemLayers: [{ id: 'l' }],
          ...(registry ? { registry } : {}),
          initial: [{ id: C, kind: 'group', layer: 'l', pose: CONTAINER, data: null }],
        });
        scene.add({ id: asNodeId('a'), kind: 'mark', layer: 'l', pose: LOOSE, data: null, parent: C });
        scene.add({ id: asNodeId('b'), kind: 'mark', layer: 'l', pose: LOOSE, data: null, parent: C });
        return scene;
      }
      const adapterOf = (scene: ReturnType<typeof bare>) => ({
        setLayout: (id: string, layout: LayoutStrategy<RectPose> | string | null) => scene.setLayout(asNodeId(id), layout),
        setPose: (id: string, pose: RectPose) => scene.setPose(asNodeId(id), pose),
      });

      it('arranges the container from an applyBatch op, and one undo takes both back', () => {
        const scene = bare();
        const layout = stack();
        const depth = scene.historyIndex();
        scene.applyBatch([createSetLayoutOp({ id: C as string, from: null, to: layout })], 'Lay out', adapterOf(scene));
        expect(scene.layoutOf(C)).toBe(layout);
        expect(posOf(scene, 'b')).toEqual([100, 110]);
        expect(scene.historyIndex()).toBe(depth + 1);

        scene.undo();
        expect(scene.layoutOf(C)).toBeNull();
        expect(scene.get(asNodeId('b'))!.pose).toEqual(LOOSE);
        scene.redo();
        expect(scene.layoutOf(C)).toBe(layout);
        expect(posOf(scene, 'b')).toEqual([100, 110]);
      });

      it('arranges the container from a custom op that sets the layout itself', () => {
        const scene = bare();
        const layout = stack();
        const depth = scene.historyIndex();
        const custom = (to: LayoutStrategy<RectPose> | null): import('core/ops/types').Op => ({
          name: 'test:layOut',
          apply: (adapter) => { (adapter as ReturnType<typeof adapterOf>).setLayout(C as string, to); },
          invert: () => custom(to === null ? layout : null),
        });
        scene.applyBatch([custom(layout)], 'Lay out', adapterOf(scene));
        expect(scene.layoutOf(C)).toBe(layout);
        expect(posOf(scene, 'b')).toEqual([100, 110]);
        expect(scene.historyIndex()).toBe(depth + 1);

        scene.undo();
        expect(scene.layoutOf(C)).toBeNull();
        expect(scene.get(asNodeId('b'))!.pose).toEqual(LOOSE);
      });

      it('arranges the container from a setLayout inside scene.batch', () => {
        const scene = bare();
        scene.batch('Lay out', () => scene.setLayout(C, stack()));
        expect(posOf(scene, 'b')).toEqual([100, 110]);
        scene.undo();
        expect(scene.layoutOf(C)).toBeNull();
        expect(scene.get(asNodeId('b'))!.pose).toEqual(LOOSE);
      });

      it('undoes and redoes a restored history of that op', () => {
        const registry = { layout: { stack: stack() } };
        const scene = bare(registry);
        scene.applyBatch([createSetLayoutOp({ id: C as string, from: null, to: 'stack' })], 'Lay out', adapterOf(scene));
        const saved = JSON.parse(JSON.stringify({ doc: scene.toJSON(), history: scene.serializeHistory() }));

        const back = sceneFromJSON<null, 'l', RectPose>(saved.doc, { registry });
        back.setHistoryAdapter(() => adapterOf(back));
        back.restoreHistory(saved.history);
        expect(posOf(back, 'b')).toEqual([100, 110]);
        back.undo();
        expect(back.layoutOf(C)).toBeNull();
        expect(back.get(asNodeId('b'))!.pose).toEqual(LOOSE);
        back.redo();
        expect(back.layoutOf(C)).toBe(registry.layout.stack);
        expect(posOf(back, 'b')).toEqual([100, 110]);
      });
    });

    it('rebuilds an op that names its layouts by key', () => {
      const op = rebuildOp('setLayout', { id: 'C', from: 'stack', to: null })!;
      const calls: unknown[] = [];
      op.apply({ setLayout: (...args: unknown[]) => calls.push(args) });
      op.invert().apply({ setLayout: (...args: unknown[]) => calls.push(args) });
      expect(calls).toEqual([['C', null], ['C', 'stack']]);
    });
  });
});
