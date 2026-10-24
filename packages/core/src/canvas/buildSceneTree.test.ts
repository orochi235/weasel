import { describe, it, expect } from 'vitest';
import { createScene } from 'core/scene/scene';
import { sceneToAdapter } from './sceneAdapter';
import { buildSceneTree } from './buildSceneTree';
import type { DrawCommand } from '@weasel-js/renderer';
import type { View } from 'core/viewport/view';

interface Data { label: string }
interface Pose { x: number; y: number; width: number; height: number }

function makeScene() {
  return createScene<Data, 'bg' | 'fg', Pose>({
    systemLayers: [{ id: 'bg' }, { id: 'fg' }],
  });
}

const POSE: Pose = { x: 0, y: 0, width: 10, height: 10 };
const VIEW: View = { x: 0, y: 0, scale: { x: 1, y: 1 } };

function labelDraw(node: { data: Data }, _pose: Pose): DrawCommand[] {
  return [{ kind: 'path', path: { kind: 'rect', x: 0, y: 0, width: 10, height: 10 }, fill: { paint: { color: node.data.label } } }];
}

describe('buildSceneTree', () => {
  it('does not paint a hidden node, or anything under a hidden container', () => {
    const scene = makeScene();
    const box = scene.add({ kind: 'group', layer: 'bg', pose: POSE, data: { label: 'box' } });
    scene.add({ kind: 'mark', layer: 'fg', pose: POSE, data: { label: 'kid' }, parent: box });
    const lone = scene.add({ kind: 'mark', layer: 'fg', pose: POSE, data: { label: 'lone' } });
    scene.add({ kind: 'mark', layer: 'fg', pose: POSE, data: { label: 'shown' } });
    scene.setHidden(box, true);
    scene.setHidden(lone, true);
    const painted: string[] = [];
    const draw = (node: { data: Data }, pose: Pose): DrawCommand[] => {
      painted.push(node.data.label);
      return labelDraw(node, pose);
    };
    buildSceneTree(sceneToAdapter(scene) as never, draw as never, VIEW);
    expect(painted).toEqual(['shown']);
  });

  it('does not call the painter for a node on a hidden layer', () => {
    const scene = makeScene();
    scene.add({ kind: 'mark', layer: 'bg', pose: POSE, data: { label: 'hidden' } });
    scene.add({ kind: 'mark', layer: 'fg', pose: POSE, data: { label: 'shown' } });
    scene.setLayerVisible('bg', false);
    const painted: string[] = [];
    const draw = (node: { data: Data }, pose: Pose): DrawCommand[] => {
      painted.push(node.data.label);
      return labelDraw(node, pose);
    };
    const out = buildSceneTree(sceneToAdapter(scene) as never, draw as never, VIEW);
    expect(out).toHaveLength(1);
    expect(painted).toEqual(['shown']);
  });

  it('flat scene → one root group per layer, leaf wrappers inside', () => {
    const scene = makeScene();
    scene.add({ kind: 'mark', layer: 'bg', pose: POSE, data: { label: 'a' } });
    scene.add({ kind: 'mark', layer: 'fg', pose: POSE, data: { label: 'b' } });
    const adapter = sceneToAdapter(scene);
    const out = buildSceneTree(adapter as never, labelDraw as never, VIEW);
    expect(out).toHaveLength(2);
    expect(out[0].kind).toBe('group');
    expect(out[1].kind).toBe('group');
    expect((out[0] as { children: DrawCommand[] }).children).toHaveLength(1);
    expect((out[1] as { children: DrawCommand[] }).children).toHaveLength(1);
  });

  it('container with two same-layer children → flat bucket [container, child1, child2] in DFS order', () => {
    const scene = makeScene();
    const aabb = { kind: 'rect' as const, x: POSE.x, y: POSE.y, width: POSE.width, height: POSE.height };
    const bed = scene.add({ kind: 'group', layer: 'bg', pose: POSE, data: { label: 'bed' }, clipFromPose: () => aabb });
    scene.add({ kind: 'mark', layer: 'bg', pose: POSE, data: { label: 'p1' }, parent: bed });
    scene.add({ kind: 'mark', layer: 'bg', pose: POSE, data: { label: 'p2' }, parent: bed });
    const adapter = sceneToAdapter(scene);
    const out = buildSceneTree(adapter as never, labelDraw as never, VIEW);
    const bgGroup = out[0] as { children: DrawCommand[] };
    // Nodes are bucketed flat by their own layer (DFS pre-order), not nested
    // under the container group.
    expect(bgGroup.children).toHaveLength(3);
    for (const c of bgGroup.children) expect((c as { kind: string }).kind).toBe('group');
    // The container's own paint is not under its clip; both children are.
    expect((bgGroup.children[0] as { clip?: unknown }).clip).toBeUndefined();
    expect((bgGroup.children[1] as { clip?: unknown }).clip).toEqual(aabb);
    expect((bgGroup.children[2] as { clip?: unknown }).clip).toEqual(aabb);
  });

  it('nested containers (3 levels) → each node clipped by its full ancestor chain', () => {
    const scene = makeScene();
    const clip = () => ({ kind: 'rect' as const, ...POSE });
    const a = scene.add({ kind: 'group', layer: 'bg', pose: POSE, data: { label: 'a' }, clipFromPose: clip });
    const b = scene.add({ kind: 'group', layer: 'bg', pose: POSE, data: { label: 'b' }, parent: a, clipFromPose: clip });
    scene.add({ kind: 'mark', layer: 'bg', pose: POSE, data: { label: 'c' }, parent: b });
    const adapter = sceneToAdapter(scene);
    const out = buildSceneTree(adapter as never, labelDraw as never, VIEW);
    const bg = (out[0] as { children: DrawCommand[] }).children;
    // a, b, c all flattened into the bg bucket.
    expect(bg).toHaveLength(3);
    // Leaf c is wrapped in TWO nested clip groups (a's clip, then b's clip).
    const cOuter = bg[2] as { kind: string; clip?: unknown; children: DrawCommand[] };
    expect(cOuter.kind).toBe('group');
    expect(cOuter.clip).toBeDefined(); // ancestor a's clip
    const cInner = cOuter.children[0] as { kind: string; clip?: unknown; children: DrawCommand[] };
    expect(cInner.clip).toBeDefined(); // b's clip
    const cLeaf = cInner.children[0] as { children: DrawCommand[] };
    expect((cLeaf.children[0] as { kind: string }).kind).toBe('path');
  });

  it('empty drawOne output still produces a wrapper group (stable tree shape)', () => {
    const scene = makeScene();
    scene.add({ kind: 'mark', layer: 'bg', pose: POSE, data: { label: 'a' } });
    const adapter = sceneToAdapter(scene);
    const out = buildSceneTree(adapter as never, () => [], VIEW);
    const bgGroup = out[0] as { children: DrawCommand[] };
    expect(bgGroup.children).toHaveLength(1);
    const leafWrapper = bgGroup.children[0] as { kind: string; children: DrawCommand[] };
    expect(leafWrapper.kind).toBe('group');
    expect(leafWrapper.children).toHaveLength(0);
  });

  it('multiple top-level roots on the same layer are all wrapped in that layer group', () => {
    const scene = makeScene();
    scene.add({ kind: 'mark', layer: 'bg', pose: POSE, data: { label: 'a' } });
    scene.add({ kind: 'mark', layer: 'bg', pose: POSE, data: { label: 'b' } });
    scene.add({ kind: 'mark', layer: 'bg', pose: POSE, data: { label: 'c' } });
    const adapter = sceneToAdapter(scene);
    const out = buildSceneTree(adapter as never, labelDraw as never, VIEW);
    const bgGroup = out[0] as { children: DrawCommand[] };
    expect(bgGroup.children).toHaveLength(3);
  });

  it('container with clipFromPose returning a path → its child\'s group has clip field set', () => {
    const scene = makeScene();
    const clipPath: import('@weasel-js/geom').Path = {
      kind: 'rect', x: 0, y: 0, width: 50, height: 50,
    };
    const bed = scene.add({
      kind: 'group',
      layer: 'bg',
      pose: POSE,
      data: { label: 'bed' },
      clipFromPose: () => clipPath,
    });
    scene.add({ kind: 'mark', layer: 'bg', pose: POSE, data: { label: 'p' }, parent: bed });
    const adapter = sceneToAdapter(scene);
    const out = buildSceneTree(adapter as never, labelDraw as never, VIEW);
    const bgGroup = out[0] as { children: DrawCommand[] };
    const childGroup = bgGroup.children[1] as { kind: string; clip?: unknown; children: DrawCommand[] };
    expect(childGroup.clip).toBe(clipPath);
  });

  it('container with clipFromPose returning null → group has no clip field', () => {
    const scene = makeScene();
    scene.add({
      kind: 'group', layer: 'bg', pose: POSE, data: { label: 'bed' },
      clipFromPose: () => null,
    });
    const adapter = sceneToAdapter(scene);
    const out = buildSceneTree(adapter as never, labelDraw as never, VIEW);
    const bedGroup = (out[0] as { children: DrawCommand[] }).children[0] as { clip?: unknown };
    expect(bedGroup.clip).toBeUndefined();
  });

  it('a plain container clips nothing: no painter claims it, so it has no silhouette', () => {
    const scene = makeScene();
    scene.add({ kind: 'group', layer: 'bg', pose: POSE, data: { label: 'bed' } });
    const adapter = sceneToAdapter(scene);
    const out = buildSceneTree(adapter as never, labelDraw as never, VIEW);
    const bedGroup = (out[0] as { children: DrawCommand[] }).children[0] as { clip?: unknown };
    expect(bedGroup.clip).toBeUndefined();
  });

  it('calls clipFromPose with the pose the node has at walk time', () => {
    const scene = makeScene();
    let received: Pose | null = null;
    const id = scene.add({
      kind: 'group', layer: 'bg', pose: POSE, data: { label: 'bed' },
      clipFromPose: (pose: Pose) => { received = pose; return null; },
    });
    const adapter = sceneToAdapter(scene);
    const moved: Pose = { x: 70, y: 80, width: 10, height: 10 };
    scene.setPose(id, moved);
    buildSceneTree(adapter as never, labelDraw as never, VIEW);
    expect(received).toEqual(moved);
  });
});
