import { describe, expect, it } from 'vitest';
import { createScene } from 'core/scene/scene';
import { TrimOverrideRegistry } from '@weasel-js/animator';
import { pathFromD } from '@weasel-js/geom';
import { INHERIT, type StrokeTrim } from '@weasel-js/paint';
import type { DrawCommand, PathDrawCommand } from '@weasel-js/renderer';
import { pathFromParts } from 'core/scene/derivedParts';
import { createPathLayer } from 'domains/paths/pathLayer';
import { defaultDrawOne } from './defaultDrawOne';
import { wireSceneSlotToScene } from './sceneSlotWiring';
import { buildSceneViewCommands } from './sceneViewRender';
import { overrideTrim } from './trimOverrides';
import { strokeOf } from '../util/paint';

const VIEW = { x: 0, y: 0, scale: { x: 1, y: 1 } };
const POSE = { x: 0, y: 0, width: 100, height: 40 };
const PATH = pathFromD('M0 20 L50 0 L100 20');

function strokedScene(trim?: StrokeTrim) {
  const scene = createScene<Record<string, unknown>, 'main'>({ systemLayers: [{ id: 'main' }] });
  const id = scene.add({
    kind: 'mark',
    layer: 'main',
    pose: POSE,
    data: { path: PATH, stroke: { ...strokeOf('#fff', 4), ...(trim ? { trim } : {}) } },
  });
  return { scene, id };
}

function pathsOf(cmds: readonly DrawCommand[]): PathDrawCommand[] {
  return cmds.flatMap((cmd) => (cmd.kind === 'path' ? [cmd] : cmd.kind === 'group' ? pathsOf(cmd.children) : []));
}

function paintedTrims(scene: ReturnType<typeof strokedScene>['scene'], registry: TrimOverrideRegistry) {
  const slot = wireSceneSlotToScene({ drawOne: defaultDrawOne }, scene, undefined, { trimOverrides: registry });
  return [...scene.renderOrder()].flatMap((id) => {
    const node = scene.get(id)!;
    return pathsOf(slot.drawOne(node, node.pose, VIEW)).flatMap((cmd) => (cmd.stroke ? [cmd.stroke.trim] : []));
  });
}

describe('overrideTrim', () => {
  it("replaces the edges the override sets and keeps the base's pace", () => {
    expect(overrideTrim({ start: 0.1, end: 0.9, pace: 'anchor' }, { end: 0.5 }))
      .toEqual({ start: 0.1, end: 0.5, pace: 'anchor' });
  });

  it('keeps an absolute edge the override leaves out, and reads the one it sets as a fraction', () => {
    expect(overrideTrim({ start: { length: 12 }, end: { anchor: 2 } }, { end: 0.25 }))
      .toEqual({ start: { length: 12 }, end: 0.25 });
  });

  it('gives a stroke with no trim the override alone', () => {
    expect(overrideTrim(undefined, { end: 0.5 })).toEqual({ end: 0.5 });
  });

  it('leaves the base for an override that sets nothing', () => {
    const base = { end: 0.3 };
    expect(overrideTrim(base, {})).toBe(base);
    expect(overrideTrim(base, undefined)).toBe(base);
  });
});

describe('animated stroke trims on default-painted nodes', () => {
  it("the live scene slot paints an override over the node's own trim", () => {
    const { scene, id } = strokedScene({ start: 0.2, pace: 'anchor' });
    const registry = new TrimOverrideRegistry();
    registry.set(id, { end: 0.5 });
    expect(paintedTrims(scene, registry)).toEqual([{ start: 0.2, end: 0.5, pace: 'anchor' }]);
  });

  it('the headless walk paints the same override', () => {
    const { scene, id } = strokedScene();
    const registry = new TrimOverrideRegistry();
    registry.set(id, { end: 0.5 });
    const cmds = buildSceneViewCommands(scene, VIEW, defaultDrawOne, undefined, undefined, undefined, { trimOverrides: registry });
    expect(pathsOf(cmds).map((cmd) => cmd.stroke?.trim)).toEqual([{ end: 0.5 }]);
  });

  it("paints the node's own trim again once the override clears, on the same path", () => {
    const { scene, id } = strokedScene({ end: 0.8 });
    const registry = new TrimOverrideRegistry();
    const slot = wireSceneSlotToScene({ drawOne: defaultDrawOne }, scene, undefined, { trimOverrides: registry });
    const node = scene.get(id)!;
    const before = pathsOf(slot.drawOne(node, node.pose, VIEW))[0]!;
    registry.set(id, { end: 0.1 });
    const during = pathsOf(slot.drawOne(node, node.pose, VIEW))[0]!;
    registry.clear(id);
    const after = pathsOf(slot.drawOne(node, node.pose, VIEW))[0]!;
    expect(during.stroke?.trim).toEqual({ end: 0.1 });
    expect(during.path).toBe(before.path);
    expect(after).toBe(before);
  });

  it("leaves the scene's data and history alone", () => {
    const { scene, id } = strokedScene({ end: 0.8 });
    const data = scene.get(id)!.data;
    const undoable = scene.history.canUndo();
    const registry = new TrimOverrideRegistry();
    registry.set(id, { end: 0.5 });
    paintedTrims(scene, registry);
    expect(scene.get(id)!.data).toBe(data);
    expect(scene.history.canUndo()).toBe(undoable);
  });

  it('trims the stroke of a built-in shape node', () => {
    const scene = createScene<Record<string, unknown>, 'main'>({ systemLayers: [{ id: 'main' }] });
    const id = scene.add({ kind: 'mark', layer: 'main', pose: POSE, data: { shape: 'rect', stroke: strokeOf('#fff', 2) } });
    const registry = new TrimOverrideRegistry();
    registry.set(id, { start: 0.25 });
    expect(paintedTrims(scene, registry)).toEqual([{ start: 0.25 }]);
  });

  it("reaches a derived part stroked as its node, and not a part with a stroke of its own", () => {
    const scene = createScene<Record<string, unknown>, 'main'>({ systemLayers: [{ id: 'main' }] });
    const anchor = scene.add({ kind: 'mark', layer: 'main', pose: POSE, data: {} });
    const own = { ...strokeOf('#000', 1), trim: { end: 0.9 } };
    const id = scene.add({
      kind: 'mark',
      layer: 'main',
      pose: { x: 0, y: 0, width: 0, height: 0 },
      data: { stroke: { ...strokeOf('#fff', 2), trim: { start: 0.1 } } },
      dependsOn: [anchor],
      derivePath: () => pathFromParts([
        { path: pathFromD('M0 0 L100 0'), stroke: INHERIT },
        { path: pathFromD('M0 50 L100 50'), stroke: own },
      ]),
    });
    const registry = new TrimOverrideRegistry();
    registry.set(id, { end: 0.5 });
    expect(paintedTrims(scene, registry)).toEqual([{ start: 0.1, end: 0.5 }, { end: 0.9 }]);
  });

  it("trims a derived path's single stroke", () => {
    const scene = createScene<Record<string, unknown>, 'main'>({ systemLayers: [{ id: 'main' }] });
    const anchor = scene.add({ kind: 'mark', layer: 'main', pose: POSE, data: {} });
    const id = scene.add({
      kind: 'mark',
      layer: 'main',
      pose: { x: 0, y: 0, width: 0, height: 0 },
      data: { stroke: strokeOf('#fff', 2) },
      dependsOn: [anchor],
      derivePath: () => pathFromD('M0 0 L100 0'),
    });
    const registry = new TrimOverrideRegistry();
    registry.set(id, { end: 0.5 });
    expect(paintedTrims(scene, registry)).toEqual([{ end: 0.5 }]);
  });
});

describe('createPathLayer trimOverrides', () => {
  it("replaces the edges of getStroke's trim", () => {
    const registry = new TrimOverrideRegistry();
    registry.set('a', { end: 0.5 });
    const layer = createPathLayer({
      getNodes: () => [{ id: 'a' }, { id: 'b' }],
      getPath: () => PATH,
      getStroke: () => ({ ...strokeOf('#fff', 2), trim: { start: 0.1 } }),
      trimOverrides: registry,
    });
    const drawn = pathsOf(layer.draw(null, VIEW, { width: 100, height: 100, dpr: 1 }));
    expect(drawn.map((cmd) => cmd.stroke?.trim)).toEqual([{ start: 0.1, end: 0.5 }, { start: 0.1 }]);
  });
});
