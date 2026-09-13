import { describe, expect, it } from 'vitest';
import { createScene } from 'core/scene/scene';
import { ColorOverrideRegistry } from '../animation/colorRegistry';
import { pathFromD } from 'features/paths/pathFromD';
import { countPathAnchors } from 'features/paths/anchors';
import { defaultDrawOne } from './defaultDrawOne';
import { wireSceneSlotToScene } from './sceneSlotWiring';
import { buildSceneViewCommands } from './sceneViewRender';
import { solid, strokeOf } from '../util/paint';
import type { DrawCommand, PathDrawCommand } from '../renderer';

const VIEW = { x: 0, y: 0, scale: { x: 1, y: 1 } };
const POSE = { x: 0, y: 0, width: 100, height: 40 };
// Three anchors.
const PATH = pathFromD('M0 20 L50 0 L100 20');
const RAINBOW = [1, 0, 0, 1, 0, 1, 0, 1, 0, 0, 1, 1];
const RED = [1, 0, 0, 1, 1, 0, 0, 1, 1, 0, 0, 1];
const GRAY = [0.5, 0.5, 0.5, 1, 0.5, 0.5, 0.5, 1, 0.5, 0.5, 0.5, 1];

function strokedScene() {
  const scene = createScene<Record<string, unknown>, 'main'>({ systemLayers: [{ id: 'main' }] });
  const id = scene.add({
    kind: 'leaf',
    layer: 'main',
    pose: POSE,
    data: { path: PATH, stroke: { ...strokeOf('#fff', 4), vertexColors: RAINBOW } },
  });
  return { scene, id };
}

function bodyOf(cmds: readonly DrawCommand[]): PathDrawCommand {
  for (const cmd of cmds) {
    if (cmd.kind === 'path') return cmd;
    if (cmd.kind === 'group') {
      const found = bodyOf(cmd.children);
      if (found) return found;
    }
  }
  return undefined as unknown as PathDrawCommand;
}

describe('animated vertex colors on default-painted nodes', () => {
  it('the live scene slot paints a stroke override in place of the node\'s own colors', () => {
    const { scene, id } = strokedScene();
    const registry = new ColorOverrideRegistry();
    registry.set(id, 'stroke', RED);
    const slot = wireSceneSlotToScene({ drawOne: defaultDrawOne }, scene, undefined, registry);
    const node = scene.get(id)!;
    expect(bodyOf(slot.drawOne(node, node.pose, VIEW)).stroke?.vertexColors).toEqual(RED);
  });

  it('the headless walk paints the same override', () => {
    const { scene, id } = strokedScene();
    const registry = new ColorOverrideRegistry();
    registry.set(id, 'stroke', RED);
    const cmds = buildSceneViewCommands(scene, VIEW, defaultDrawOne, undefined, undefined, undefined, undefined, registry);
    expect(bodyOf(cmds).stroke?.vertexColors).toEqual(RED);
  });

  it('hands a function override the node\'s own colors as its base', () => {
    const { scene, id } = strokedScene();
    const registry = new ColorOverrideRegistry();
    let seen: readonly number[] | undefined;
    registry.set(id, 'stroke', (base) => { seen = base; return GRAY; });
    const slot = wireSceneSlotToScene({ drawOne: defaultDrawOne }, scene, undefined, registry);
    const node = scene.get(id)!;
    expect(bodyOf(slot.drawOne(node, node.pose, VIEW)).stroke?.vertexColors).toEqual(GRAY);
    expect(seen).toEqual(RAINBOW);
  });

  it('paints the node\'s own colors again once the override clears, without re-tessellating', () => {
    const { scene, id } = strokedScene();
    const registry = new ColorOverrideRegistry();
    const slot = wireSceneSlotToScene({ drawOne: defaultDrawOne }, scene, undefined, registry);
    const node = scene.get(id)!;
    const before = bodyOf(slot.drawOne(node, node.pose, VIEW));

    registry.set(id, 'stroke', RED);
    const during = bodyOf(slot.drawOne(node, node.pose, VIEW));
    registry.clear(id, 'stroke');
    const after = bodyOf(slot.drawOne(node, node.pose, VIEW));

    expect(during.path).toBe(before.path);
    expect(after.stroke?.vertexColors).toEqual(RAINBOW);
  });

  it('drops an override whose length does not match the path\'s anchors', () => {
    const { scene, id } = strokedScene();
    const registry = new ColorOverrideRegistry();
    registry.set(id, 'stroke', [1, 0, 0, 1]);
    const slot = wireSceneSlotToScene({ drawOne: defaultDrawOne }, scene, undefined, registry);
    const node = scene.get(id)!;
    expect(bodyOf(slot.drawOne(node, node.pose, VIEW)).stroke?.vertexColors).toEqual(RAINBOW);
  });

  it('paints a path node\'s fill vertex colors from its data, and animates them', () => {
    const scene = createScene<Record<string, unknown>, 'main'>({ systemLayers: [{ id: 'main' }] });
    const id = scene.add({
      kind: 'leaf',
      layer: 'main',
      pose: POSE,
      data: { path: pathFromD('M0 0 L100 0 L50 40 Z'), fill: solid('#fff'), vertexColors: RAINBOW },
    });
    const registry = new ColorOverrideRegistry();
    const slot = wireSceneSlotToScene({ drawOne: defaultDrawOne }, scene, undefined, registry);
    const node = scene.get(id)!;
    expect(bodyOf(slot.drawOne(node, node.pose, VIEW)).vertexColors).toEqual(RAINBOW);

    registry.set(id, 'fill', GRAY);
    expect(bodyOf(slot.drawOne(node, node.pose, VIEW)).vertexColors).toEqual(GRAY);
  });

  it('animates the stroke of a built-in shape node', () => {
    const scene = createScene<Record<string, unknown>, 'main'>({ systemLayers: [{ id: 'main' }] });
    const id = scene.add({
      kind: 'leaf',
      layer: 'main',
      pose: POSE,
      data: { shape: 'rect', stroke: strokeOf('#fff', 2) },
    });
    const node = scene.get(id)!;
    const registry = new ColorOverrideRegistry();
    const slot = wireSceneSlotToScene({ drawOne: defaultDrawOne }, scene, undefined, registry);
    const body = bodyOf(slot.drawOne(node, node.pose, VIEW));
    const colors = Array.from({ length: countPathAnchors(body.path) }, () => [0, 1, 0, 1]).flat();

    registry.set(id, 'stroke', colors);
    expect(bodyOf(slot.drawOne(node, node.pose, VIEW)).stroke?.vertexColors).toEqual(colors);
  });
});
