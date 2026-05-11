import { describe, it, expect } from 'vitest';
import { createScene } from 'core/scene/scene';
import { sceneToAdapter } from './sceneAdapter';
import { buildSceneTree } from './buildSceneTree';
import type { DrawCommand } from '../renderer';
import type { View } from 'core/viewport/view';

interface Data { label: string }
interface Pose { x: number; y: number; width: number; height: number }

function makeScene() {
  return createScene<Data, 'bg' | 'fg', Pose>({
    systemLayers: [{ id: 'bg' }, { id: 'fg' }],
  });
}

const POSE: Pose = { x: 0, y: 0, width: 10, height: 10 };
const VIEW: View = { x: 0, y: 0, scale: 1 };

function labelDraw(node: { data: Data }, _pose: Pose): DrawCommand[] {
  return [{ kind: 'path', path: { kind: 'rect', x: 0, y: 0, width: 10, height: 10 }, fill: { color: node.data.label } }];
}

describe('buildSceneTree', () => {
  it('flat scene → one root group per layer, leaf wrappers inside', () => {
    const scene = makeScene();
    scene.add({ kind: 'leaf', layer: 'bg', pose: POSE, data: { label: 'a' } });
    scene.add({ kind: 'leaf', layer: 'fg', pose: POSE, data: { label: 'b' } });
    const adapter = sceneToAdapter(scene);
    const out = buildSceneTree(adapter as never, labelDraw as never, VIEW);
    expect(out).toHaveLength(2);
    expect(out[0].kind).toBe('group');
    expect(out[1].kind).toBe('group');
    expect((out[0] as { children: DrawCommand[] }).children).toHaveLength(1);
    expect((out[1] as { children: DrawCommand[] }).children).toHaveLength(1);
  });

  it('container with two same-layer children → group with [container_self, child1_group, child2_group]', () => {
    const scene = makeScene();
    const bed = scene.add({ kind: 'container', layer: 'bg', pose: POSE, data: { label: 'bed' } });
    scene.add({ kind: 'leaf', layer: 'bg', pose: POSE, data: { label: 'p1' }, parent: bed });
    scene.add({ kind: 'leaf', layer: 'bg', pose: POSE, data: { label: 'p2' }, parent: bed });
    const adapter = sceneToAdapter(scene);
    const out = buildSceneTree(adapter as never, labelDraw as never, VIEW);
    const bgGroup = out[0] as { children: DrawCommand[] };
    expect(bgGroup.children).toHaveLength(1);
    const bedGroup = bgGroup.children[0] as { kind: 'group'; children: DrawCommand[] };
    expect(bedGroup.kind).toBe('group');
    expect(bedGroup.children).toHaveLength(3);
    expect((bedGroup.children[0] as { kind: string }).kind).toBe('path');
    expect((bedGroup.children[1] as { kind: string }).kind).toBe('group');
    expect((bedGroup.children[2] as { kind: string }).kind).toBe('group');
  });

  it('nested containers (3 levels) produce matching nested groups', () => {
    const scene = makeScene();
    const a = scene.add({ kind: 'container', layer: 'bg', pose: POSE, data: { label: 'a' } });
    const b = scene.add({ kind: 'container', layer: 'bg', pose: POSE, data: { label: 'b' }, parent: a });
    scene.add({ kind: 'leaf', layer: 'bg', pose: POSE, data: { label: 'c' }, parent: b });
    const adapter = sceneToAdapter(scene);
    const out = buildSceneTree(adapter as never, labelDraw as never, VIEW);
    const aGroup = (out[0] as { children: DrawCommand[] }).children[0] as { children: DrawCommand[] };
    expect(aGroup.children).toHaveLength(2);
    const bGroup = aGroup.children[1] as { kind: string; children: DrawCommand[] };
    expect(bGroup.kind).toBe('group');
    expect(bGroup.children).toHaveLength(2);
    const cGroup = bGroup.children[1] as { kind: string; children: DrawCommand[] };
    expect(cGroup.kind).toBe('group');
    expect(cGroup.children).toHaveLength(1);
    expect((cGroup.children[0] as { kind: string }).kind).toBe('path');
  });

  it('hidden layer is omitted from output', () => {
    const scene = makeScene();
    scene.add({ kind: 'leaf', layer: 'bg', pose: POSE, data: { label: 'a' } });
    scene.add({ kind: 'leaf', layer: 'fg', pose: POSE, data: { label: 'b' } });
    scene.setLayerVisible('bg', false);
    const adapter = sceneToAdapter(scene);
    const out = buildSceneTree(adapter as never, labelDraw as never, VIEW);
    expect(out).toHaveLength(1);
  });

  it('empty drawOne output still produces a wrapper group (stable tree shape)', () => {
    const scene = makeScene();
    scene.add({ kind: 'leaf', layer: 'bg', pose: POSE, data: { label: 'a' } });
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
    scene.add({ kind: 'leaf', layer: 'bg', pose: POSE, data: { label: 'a' } });
    scene.add({ kind: 'leaf', layer: 'bg', pose: POSE, data: { label: 'b' } });
    scene.add({ kind: 'leaf', layer: 'bg', pose: POSE, data: { label: 'c' } });
    const adapter = sceneToAdapter(scene);
    const out = buildSceneTree(adapter as never, labelDraw as never, VIEW);
    const bgGroup = out[0] as { children: DrawCommand[] };
    expect(bgGroup.children).toHaveLength(3);
  });
});
