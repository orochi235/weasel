/**
 * A group that paints its own box: `data.background` and `data.border` drawn
 * along its pose, under its children, where the group's box is.
 */
import { describe, expect, it } from 'vitest';
import type { DrawCommand, GroupDrawCommand, PathDrawCommand } from '@weasel-js/renderer';
import { createScene } from 'core/scene/scene';
import { RIGID_POSE_COMPOSITION } from 'core/scene/composePose';
import { asNodeId, type Node, type RectPose } from 'core/scene/types';
import type { View } from 'core/viewport/view';
import { solid } from '../util/paint';
import { buildSceneTree } from './buildSceneTree';
import { defaultDrawOne, defaultPaintBounds } from './defaultDrawOne';
import { drawnBoundsOf } from './drawnBounds';
import { pickWalk, scenePickSource } from './pickWalk';
import { sceneToAdapter } from './sceneAdapter';

const BOX: RectPose = { x: 10, y: 20, width: 80, height: 40 };
const VIEW: View = { x: 0, y: 0, scale: { x: 1, y: 1 } };
const BG = { paint: solid('#fbf7ee') };
const BORDER = { paint: solid('#d4c4a8'), width: 2 };

type Data = Record<string, unknown>;

function group(data: Data, pose: RectPose = BOX): Node<Data, 'main', RectPose> {
  return { id: asNodeId('g'), kind: 'group', layer: 'main', pose, data, parent: null };
}

/** Every path command in `cmds`, groups opened. */
function paths(cmds: readonly DrawCommand[]): PathDrawCommand[] {
  return cmds.flatMap((c) => (c.kind === 'group' ? paths(c.children) : c.kind === 'path' ? [c] : []));
}

function tree(scene: ReturnType<typeof createScene<Data, 'main', RectPose>>): GroupDrawCommand[] {
  return buildSceneTree(
    sceneToAdapter(scene) as unknown as Parameters<typeof buildSceneTree>[0],
    defaultDrawOne as unknown as Parameters<typeof buildSceneTree>[1],
    VIEW,
  ) as GroupDrawCommand[];
}

describe('a group with a background and a border', () => {
  it('paints its pose box filled with the background and stroked with the border', () => {
    const [cmd, ...rest] = defaultDrawOne(group({ background: BG, border: BORDER }), BOX) as PathDrawCommand[];
    expect(rest).toEqual([]);
    expect(cmd!.path).toEqual({ kind: 'rect', x: 10, y: 20, width: 80, height: 40 });
    expect(cmd!.fill).toEqual({ paint: { color: '#fbf7ee' } });
    expect(cmd!.stroke).toMatchObject({ paint: { color: '#d4c4a8' }, width: 2 });
  });

  it('paints a border alone with no fill', () => {
    const [cmd] = defaultDrawOne(group({ border: BORDER }), BOX) as PathDrawCommand[];
    expect(cmd!.fill).toBeUndefined();
    expect(cmd!.stroke).toBeDefined();
  });

  it('paints nothing for the fill and stroke its children inherit', () => {
    expect(defaultDrawOne(group({ fill: BG, stroke: BORDER }), BOX)).toEqual([]);
    expect(defaultDrawOne(group({}), BOX)).toEqual([]);
  });

  it('bounds its paint for the cull as a mark drawing the same box is bounded', () => {
    const mark: Node<Data, 'main', RectPose> = { ...group({ fill: BG, stroke: BORDER }), kind: 'mark' };
    expect(defaultPaintBounds(group({ background: BG, border: BORDER }), BOX, VIEW))
      .toEqual(defaultPaintBounds(mark, BOX, VIEW));
    expect(defaultPaintBounds(group({ fill: BG }), BOX, VIEW)).toBeNull();
  });

  it('counts its border in its drawn box', () => {
    const scene = createScene<unknown, 'main', RectPose>({ systemLayers: [{ id: 'main' }] });
    const g = scene.add({ kind: 'group', layer: 'main', pose: BOX, data: { border: BORDER } });
    scene.add({ kind: 'mark', layer: 'main', parent: g, pose: { x: 20, y: 30, width: 10, height: 10 }, data: {} });
    expect(drawnBoundsOf(scene, g, BOX)).toEqual({ x: 9, y: 19, width: 82, height: 42 });
  });
});

describe('a painted group in the scene walk', () => {
  function clipped() {
    const scene = createScene<Data, 'main', RectPose>({ systemLayers: [{ id: 'main' }], composition: RIGID_POSE_COMPOSITION });
    const g = scene.add({ kind: 'group', layer: 'main', clip: 'outline', pose: BOX, data: { background: BG, border: BORDER } });
    const kid = scene.add({ kind: 'mark', layer: 'main', parent: g, pose: { x: 0, y: 200, width: 10, height: 10 }, data: { fill: BG } });
    return { scene, g, kid };
  }

  it('paints under its children, outside its own clip', () => {
    const [layer] = tree(clipped().scene);
    const [own, kid] = layer!.children as GroupDrawCommand[];
    expect(own!.clip).toBeUndefined();
    expect(paths(own!.children)[0]!.path).toEqual({ kind: 'rect', x: 10, y: 20, width: 80, height: 40 });
    expect(kid!.clip).toBeDefined();
  });

  it('clips its children to its box when it declares `clip: "outline"` and holds no path', () => {
    const [layer] = tree(clipped().scene);
    const kid = layer!.children[1] as GroupDrawCommand;
    expect(kid.clip).toEqual({ kind: 'rect', x: 10, y: 20, width: 80, height: 40 });
  });

  it('keeps its box where it is while its content scrolls', () => {
    const { scene, g } = clipped();
    scene.scroll.set(g, { x: 0, y: 150 });
    const [layer] = tree(scene);
    const [own, kid] = layer!.children as GroupDrawCommand[];
    expect(paths(own!.children)[0]!.path).toEqual({ kind: 'rect', x: 10, y: 20, width: 80, height: 40 });
    expect(paths(kid!.children)[0]!.path).toMatchObject({ x: 10, y: 70 });
  });

  it('is picked over its box as an unpainted group is', () => {
    const pick = (data: Data) => {
      const scene = createScene<Data, 'main', RectPose>({ systemLayers: [{ id: 'main' }] });
      scene.add({ id: asNodeId('g'), kind: 'group', layer: 'main', pose: BOX, data });
      return pickWalk<RectPose>(scenePickSource(scene), {
        hits: (_n, p) => 50 >= p.x && 50 <= p.x + p.width && 40 >= p.y && 40 <= p.y + p.height,
        clipAdmits: () => true,
      });
    };
    expect(pick({ background: BG, border: BORDER })).toEqual(pick({}));
  });
});
