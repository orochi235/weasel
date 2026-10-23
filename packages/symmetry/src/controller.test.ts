import { describe, expect, it } from 'vitest';
import {
  asNodeId, createScene, RECT_POSE_COMPOSITION, sceneFromJSON, type NodeId, type RectPose, type RenderLayer,
  type SceneRegistry,
} from '@weasel-js/core';
import { rectPath } from '@weasel-js/geom';
import { createSymmetry } from './controller';
import { isSymmetryGroup, symmetryCopies, symmetryRegistry } from './group';
import { VERTICAL_AXIS } from './kinds';

function setup() {
  const scene = createScene<unknown, 'main', RectPose>({
    systemLayers: [{ id: 'main' }],
    registry: symmetryRegistry as SceneRegistry<RectPose>,
  });
  const sym = createSymmetry(scene as never);
  const group = sym.create({ center: { x: 100, y: 0 }, symmetry: { kind: 'mirror', angle: VERTICAL_AXIS } });
  const leaf = scene.add({
    kind: 'mark', layer: 'main', parent: group, id: asNodeId('sq'),
    pose: { x: 120, y: 10, width: 10, height: 10 }, data: { path: rectPath(0, 0, 10, 10) },
  });
  return { scene, sym, group, leaf };
}

const copiesOf = (scene: ReturnType<typeof setup>['scene'], id: NodeId) => {
  const node = scene.get(id)!;
  return node.kind === 'group' ? node.copiesFromPose?.(node.pose, node as never) ?? [] : [];
};

describe('createSymmetry', () => {
  it('makes the new group the active one, and forgets it once it is gone', () => {
    const { scene, sym, group } = setup();
    expect(sym.active()).toBe(group);
    scene.remove(group);
    expect(sym.active()).toBeNull();
  });

  it('mirrors about the group\'s center', () => {
    const { scene, group } = setup();
    const [m] = copiesOf(scene, group);
    expect(m[0]).toBeCloseTo(-1);
    expect(m[4]).toBeCloseTo(200);
  });

  it('moves the center with one undo step, the children staying put', () => {
    const { scene, sym, group, leaf } = setup();
    sym.update(group, { center: { x: 150, y: 0 } });
    expect(copiesOf(scene, group)[0][4]).toBeCloseTo(300);
    expect(scene.get(leaf)!.pose.x).toBe(120);
    scene.undo();
    expect(copiesOf(scene, group)[0][4]).toBeCloseTo(200);
  });

  it('changes the kind and count with one undo step', () => {
    const { scene, sym, group } = setup();
    sym.update(group, { spec: { kind: 'radial', count: 5 } });
    expect(copiesOf(scene, group)).toHaveLength(4);
    scene.undo();
    expect(copiesOf(scene, group)).toHaveLength(1);
  });

  it('records nothing for a preview', () => {
    const { scene, sym, group } = setup();
    const before = scene.historyEntries().length;
    sym.preview(group, { center: { x: 400, y: 0 } });
    expect(scene.historyEntries()).toHaveLength(before);
  });

  it('round-trips a group through JSON with its registry', () => {
    const { scene, group } = setup();
    const back = sceneFromJSON(scene.toJSON(), { registry: symmetryRegistry as SceneRegistry<RectPose> });
    const node = back.get(group)!;
    expect(node.kind === 'group' && node.copiesFromPose).toBe(symmetryCopies);
    expect(isSymmetryGroup(back as never, group)).toBe(true);
  });
});

describe('the contribution\'s deps', () => {
  it('draws into the active group, and the top of the tree with none', () => {
    const { sym, group } = setup();
    const into = sym.contribution.deps!.insertInto!()!;
    expect(into.get()).toBe(group);
    sym.setActive(null);
    expect(into.get()).toBeNull();
  });

  it('answers a path\'s group transforms for anchor edits, whichever group is active', () => {
    const { sym, leaf } = setup();
    sym.setActive(null);
    const dep = sym.contribution.deps!.pathSymmetry!()!;
    expect(dep.transforms(leaf)).toHaveLength(1);
    expect(dep.transforms('nowhere')).toEqual([]);
  });

  it('answers no transforms for a repeat, which no path is its own image under', () => {
    const { sym, group, leaf } = setup();
    sym.update(group, { spec: { kind: 'repeat', count: 4 } });
    expect(sym.contribution.deps!.pathSymmetry!()!.transforms(leaf)).toEqual([]);
  });
});

describe('bake', () => {
  it('replaces the group with a plain one holding the original and a real copy, as one undo step', () => {
    const { scene, sym, group, leaf } = setup();
    const before = scene.historyEntries().length;
    const out = sym.bake(group)!;
    expect(scene.get(group)).toBeUndefined();
    expect(isSymmetryGroup(scene as never, out.group)).toBe(false);
    const kids = scene.childrenOf(out.group);
    expect(kids).toHaveLength(2);
    expect(kids[0]).toBe(leaf);
    const copy = scene.get(kids[1])!;
    expect(copy.pose).toEqual({ x: 70, y: 10, width: 10, height: 10, transform: [-1, 0, 0, 1] });
    expect(scene.historyEntries()).toHaveLength(before + 1);
    scene.undo();
    expect(isSymmetryGroup(scene as never, group)).toBe(true);
    expect(scene.childrenOf(group)).toEqual([leaf]);
  });

  it('copies a text leaf, mirrored the way the live copy drew it', () => {
    const { scene, sym, group } = setup();
    scene.add({
      kind: 'mark', layer: 'main', parent: group, id: asNodeId('label'),
      pose: { x: 0, y: 0, width: 5, height: 5 }, data: { text: 'hi' },
    });
    const out = sym.bake(group)!;
    expect(out.skipped).toEqual([]);
    const copies = scene.childrenOf(out.group).map((id) => scene.get(id)!).filter((n) => (n.data as { text?: string }).text);
    expect(copies).toHaveLength(2);
    expect(copies[1].pose).toEqual({ x: 195, y: 0, width: 5, height: 5, transform: [-1, 0, 0, 1] });
  });

  it('turns a copy through its pose, so a paint laid out in its box turns with it', () => {
    const { scene, sym, group, leaf } = setup();
    sym.update(group, { spec: { kind: 'point' } });
    const out = sym.bake(group)!;
    const copy = scene.get(scene.childrenOf(out.group).find((id) => id !== leaf)!)!;
    const pose = copy.pose as RectPose & { rotation?: number; transform?: unknown };
    expect(pose.x).toBeCloseTo(70);
    expect(pose.y).toBeCloseTo(-20);
    expect(pose.rotation).toBeCloseTo(Math.PI);
    expect(pose.transform).toBeUndefined();
    expect(copy.data).toBe(scene.get(leaf)!.data);
  });

  it('reports a leaf whose pose is not a box and keeps it', () => {
    const { scene, sym, group } = setup();
    const odd = scene.add({
      kind: 'mark', layer: 'main', parent: group, pose: { cx: 0 } as never, data: {},
    });
    const out = sym.bake(group)!;
    expect(out.skipped).toEqual([odd]);
    expect(scene.childrenOf(out.group)).toContain(odd);
  });
});

describe('in a scene that composes frames', () => {
  function composed() {
    const scene = createScene<unknown, 'main', RectPose>({
      systemLayers: [{ id: 'main' }],
      registry: symmetryRegistry as SceneRegistry<RectPose>,
      composition: RECT_POSE_COMPOSITION,
    });
    const sym = createSymmetry(scene as never);
    const group = sym.create({ center: { x: 100, y: 0 }, symmetry: { kind: 'mirror', angle: VERTICAL_AXIS } });
    // Stored in the group's frame: (20, 10) from its center is (120, 10) in the world.
    const leaf = scene.add({
      kind: 'mark', layer: 'main', parent: group, id: asNodeId('sq'),
      pose: { x: 20, y: 10, width: 10, height: 10 }, data: { path: rectPath(0, 0, 10, 10) },
    });
    return { scene, sym, group, leaf };
  }

  it('moves the center without moving the children, as one undo step', () => {
    const { scene, sym, group, leaf } = composed();
    sym.update(group, { center: { x: 150, y: 0 } });
    expect(scene.get(leaf)!.pose).toMatchObject({ x: -30, y: 10 });
    expect(copiesOf(scene as never, group)[0][4]).toBeCloseTo(300);
    scene.undo();
    expect(scene.get(leaf)!.pose).toMatchObject({ x: 20, y: 10 });
  });

  it('keeps the children put through a previewed drag of the center', () => {
    const { scene, sym, group, leaf } = composed();
    sym.preview(group, { center: { x: 110, y: 5 } });
    sym.preview(group, { center: { x: 130, y: 0 } });
    expect(scene.get(leaf)!.pose).toMatchObject({ x: -10, y: 10 });
  });

  it('bakes the original and its copy where they drew', () => {
    const { scene, sym, group, leaf } = composed();
    const out = sym.bake(group)!;
    const [kept, copy] = scene.childrenOf(out.group);
    expect(kept).toBe(leaf);
    expect(scene.get(kept)!.pose).toMatchObject({ x: 120, y: 10 });
    expect(scene.get(copy)!.pose).toMatchObject({ x: 70, y: 10 });
  });
});

describe('the guide\'s angle knob', () => {
  const guideOf = (sym: ReturnType<typeof setup>['sym']) => {
    let layer: RenderLayer<unknown> | null = null;
    sym.contribution.attach!({ registerLayer: (l: RenderLayer<unknown>) => { layer = l; return () => {}; }, requestRedraw: () => {} } as never, undefined as never);
    return layer! as RenderLayer<unknown>;
  };
  const VIEW = { x: 0, y: 0, scale: { x: 1, y: 1 } };
  const DIMS = { width: 400, height: 400 };

  it('sits past the farthest of the group\'s contents along the axis, clear of every shape', () => {
    const { scene, sym, group } = setup();
    scene.add({
      kind: 'mark', layer: 'main', parent: group, id: asNodeId('petal'),
      pose: { x: 100, y: 60, width: 10, height: 10 }, data: { path: rectPath(0, 0, 10, 10) },
    });
    const guide = guideOf(sym);
    // The petal's far corner is hypot(10, 70) from the center at (100, 0).
    const reach = Math.hypot(10, 70);
    expect(guide.hitTest!(100, 64, undefined, VIEW, DIMS)).toBeNull();
    expect(guide.hitTest!(100, reach + 18, undefined, VIEW, DIMS)?.initialScratch).toEqual({ handle: 'angle', group });
  });

  it('keeps its set distance while the contents are nearer than that', () => {
    const { sym, group } = setup();
    expect(guideOf(sym).hitTest!(100, 64, undefined, VIEW, DIMS)?.initialScratch).toEqual({ handle: 'angle', group });
  });
});
