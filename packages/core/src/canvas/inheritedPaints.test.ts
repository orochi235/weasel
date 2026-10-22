import { describe, expect, it } from 'vitest';
import { INHERIT, type Fill, type Stroke } from '@weasel-js/paint';
import type { DrawCommand } from '@weasel-js/renderer';
import { createScene } from 'core/scene/scene';
import { asNodeId } from 'core/scene/types';
import { buildSceneViewCommands } from './sceneViewRender';
import { defaultDrawOne } from './defaultDrawOne';
import { pickWalk, scenePickSource } from './pickWalk';
import { scenePointQuery } from './SceneCanvas/scenePointQuery';
import { AUTO_POSE_DESCRIPTOR } from 'core/geometry/autoPoseDescriptor';
import { drawnBoundsOf } from './drawnBounds';

const RED: Fill = { paint: { kind: 'solid', color: '#ff0000' } };
const BLUE: Fill = { paint: { kind: 'solid', color: '#0000ff' } };
const LINE: Stroke = { paint: { kind: 'solid', color: '#000000' }, width: 4 };
const VIEW = { x: 0, y: 0, scale: { x: 1, y: 1 } };
const BOX = { x: 0, y: 0, width: 40, height: 40 };

type Data = { shape?: string; path?: unknown; fill?: unknown; stroke?: unknown };

function setup(childData: Data, groupData: Data = { fill: RED, stroke: LINE }) {
  const scene = createScene<Data, 'main'>({ systemLayers: [{ id: 'main' }] });
  const group = scene.add({ kind: 'container', id: asNodeId('g'), layer: 'main', pose: BOX, data: groupData });
  scene.add({ kind: 'leaf', id: asNodeId('c'), parent: group, layer: 'main', pose: BOX, data: childData });
  return { scene, group };
}

function pathCommands(cmds: readonly DrawCommand[]): { fill?: unknown; stroke?: unknown }[] {
  const out: { fill?: unknown; stroke?: unknown }[] = [];
  const visit = (c: DrawCommand): void => {
    if (c.kind === 'path') out.push(c as never);
    for (const k of (c as { children?: DrawCommand[] }).children ?? []) visit(k);
  };
  cmds.forEach(visit);
  return out;
}

const paintColor = (f: unknown): unknown => (f as { paint?: { color?: string } } | undefined)?.paint?.color;

describe('a node’s inherit takes its container’s paint', () => {
  it('paints an inheriting child with its container’s fill and stroke', () => {
    const { scene } = setup({ shape: 'rect', fill: INHERIT, stroke: INHERIT });
    const [cmd] = pathCommands(buildSceneViewCommands(scene, VIEW, defaultDrawOne));
    expect(paintColor(cmd.fill)).toBe('#ff0000');
    expect(paintColor(cmd.stroke)).toBe('#000000');
  });

  it('repaints the child when only the container’s fill changes, and reuses its paint when nothing does', () => {
    const { scene, group } = setup({ shape: 'rect', fill: INHERIT });
    const [first] = pathCommands(buildSceneViewCommands(scene, VIEW, defaultDrawOne));
    const [again] = pathCommands(buildSceneViewCommands(scene, VIEW, defaultDrawOne));
    expect(again).toBe(first);
    scene.update(group, { data: { fill: BLUE } });
    const [after] = pathCommands(buildSceneViewCommands(scene, VIEW, defaultDrawOne));
    expect(paintColor(after.fill)).toBe('#0000ff');
  });

  it('paints none under a container with no fill', () => {
    const { scene } = setup({ shape: 'rect', fill: INHERIT }, {});
    const [cmd] = pathCommands(buildSceneViewCommands(scene, VIEW, defaultDrawOne));
    expect(cmd.fill).toBeUndefined();
  });

  it('gives the container itself no paint of its own, even with a shape or a path to paint', () => {
    for (const own of [{ shape: 'rect' }, { path: { kind: 'rect', x: 0, y: 0, width: 1, height: 1 } }]) {
      const { scene } = setup({ shape: 'rect', fill: INHERIT }, { ...own, fill: RED, stroke: LINE });
      expect(pathCommands(buildSceneViewCommands(scene, VIEW, defaultDrawOne))).toHaveLength(1);
    }
  });
});

describe('picking an inheriting node', () => {
  const pickAt = (scene: ReturnType<typeof setup>['scene'], x: number, y: number): string[] =>
    pickWalk(scenePickSource(scene), {
      ...scenePointQuery(AUTO_POSE_DESCRIPTOR, true, 0)(x, y, { x: 1, y: 1 }),
      includeContainers: false,
    });

  it('takes a point inside a child filled by inheritance', () => {
    expect(pickAt(setup({ shape: 'rect', fill: INHERIT }).scene, 20, 20)).toEqual(['c']);
  });

  it('passes over the same point when the container has no fill', () => {
    expect(pickAt(setup({ shape: 'rect', fill: INHERIT, stroke: LINE }, {}).scene, 20, 20)).toEqual([]);
  });
});

describe('the drawn box of an inheriting node', () => {
  it('grows by the stroke it inherits', () => {
    const { scene } = setup({ shape: 'rect', stroke: INHERIT });
    const b = drawnBoundsOf(scene as never, asNodeId('c'), BOX, { scale: 1 });
    expect(b.width).toBe(44);
  });
});

describe('culling an inheriting node', () => {
  it('claims no paint box for a node whose stroke is inherited', async () => {
    const { defaultPaintBounds } = await import('./defaultDrawOne');
    const { scene } = setup({ shape: 'rect', stroke: INHERIT });
    expect(defaultPaintBounds(scene.get(asNodeId('c'))!, BOX, VIEW)).toBeNull();
  });
});

describe('paintAbove', () => {
  it('says what inherit would take, whatever the node holds now', async () => {
    const { paintAbove } = await import('./inheritedPaints');
    const { scene } = setup({ shape: 'rect', fill: BLUE });
    const above = paintAbove(scene, scene.get(asNodeId('c'))!);
    expect(above.fill).toBe(RED);
    expect(above.stroke).toBe(LINE);
  });
});
