import { describe, expect, it } from 'vitest';
import type { Fill } from '@weasel-js/paint';
import type { DrawCommand } from '@weasel-js/renderer';
import { createScene } from 'core/scene/scene';
import { asNodeId } from 'core/scene/types';
import { AUTO_POSE_DESCRIPTOR } from 'core/geometry/autoPoseDescriptor';
import { buildSceneViewCommands } from './sceneViewRender';
import { defaultDrawOne } from './defaultDrawOne';
import { pickWalk, scenePickSource } from './pickWalk';
import { scenePointQuery } from './SceneCanvas/scenePointQuery';

const RED: Fill = { paint: { kind: 'solid', color: '#ff0000' } };
const VIEW = { x: 0, y: 0, scale: { x: 1, y: 1 } };
const BOX = { x: 0, y: 0, width: 40, height: 40 };
const RECT_PATH = { kind: 'rect', x: 0, y: 0, width: 1, height: 1 };

type Data = Record<string, unknown>;

// The one child is a mark with no data: the rect fallback paints it as one path.
function sceneWith(kind: 'mark' | 'group', data: Data, child = true) {
  const scene = createScene<Data, 'main'>({ systemLayers: [{ id: 'main' }] });
  const node = scene.add({ kind, id: asNodeId('n'), layer: 'main', pose: BOX, data });
  if (child) {
    scene.add({ kind: 'mark', id: asNodeId('c'), parent: node, layer: 'main', pose: { ...BOX, width: 5, height: 5 }, data: {} });
  }
  return scene;
}

type TestScene = ReturnType<typeof sceneWith>;

function paintedPaths(scene: TestScene): number {
  let n = 0;
  const visit = (c: DrawCommand): void => {
    if (c.kind === 'path') n++;
    for (const k of (c as { children?: DrawCommand[] }).children ?? []) visit(k);
  };
  buildSceneViewCommands(scene, VIEW, defaultDrawOne).forEach(visit);
  return n;
}

describe('what a group paints', () => {
  it('emits nothing for a group with data.shape, only its child paints', () => {
    expect(paintedPaths(sceneWith('group', { shape: 'rect', fill: RED }))).toBe(1);
  });

  it('emits nothing for a group with data.path, only its child paints', () => {
    expect(paintedPaths(sceneWith('group', { path: RECT_PATH, fill: RED }))).toBe(1);
  });

  it('emits nothing for a childless group with data.shape', () => {
    expect(paintedPaths(sceneWith('group', { shape: 'rect', fill: RED }, false))).toBe(0);
  });

  it('paints a mark with a child through its own painter, as well as the child', () => {
    expect(paintedPaths(sceneWith('mark', { shape: 'rect', fill: RED }))).toBe(2);
  });
});

describe('where a group is hit', () => {
  const pickAt = (scene: TestScene, x: number, y: number): string[] =>
    pickWalk(scenePickSource(scene), {
      ...scenePointQuery(AUTO_POSE_DESCRIPTOR, true, 0)(x, y, { x: 1, y: 1 }),
      includeContainers: true,
    });

  it('takes a point in its box with no member under it', () => {
    expect(pickAt(sceneWith('group', {}), 30, 30)).toEqual(['n']);
  });

  it('takes the same point after its last member is deleted', () => {
    const scene = sceneWith('group', {});
    scene.remove(asNodeId('c'));
    expect(pickAt(scene, 30, 30)).toEqual(['n']);
  });

  it('takes a point inside a group whose data.path is an unfilled outline', () => {
    const scene = sceneWith('group', { shape: 'rect', fill: null, stroke: { paint: RED.paint, width: 2 } }, false);
    expect(pickAt(scene, 20, 20)).toEqual(['n']);
  });
});
