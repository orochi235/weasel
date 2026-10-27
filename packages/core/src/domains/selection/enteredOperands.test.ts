/** An entered boolean group outlines the children it draws only through its result. */
import { describe, expect, it } from 'vitest';
import { boundsOfPath, type Path } from '@weasel-js/geom';
import type { PathDrawCommand } from '@weasel-js/renderer';
import { createScene } from 'core/scene/scene';
import { booleanGroupFields } from 'core/scene/booleanGroup';
import type { RectPose } from 'core/scene/types';
import type { EnteredGroupApi } from 'canvas/deps/enteredGroup';
import 'canvas/NodeShape';
import { enteredOperandOutlines } from './enteredOperands';
import { createEnteredGroupFrameLayer } from './enteredGroupFrame';

const box = (x: number, y: number, width = 100, height = 100): RectPose => ({ x, y, width, height });

function makeScene() {
  const scene = createScene<{ shape?: string }, 'main', RectPose>({ systemLayers: [{ id: 'main' }] });
  const group = scene.add({ ...booleanGroupFields<RectPose>(), layer: 'main', pose: box(0, 0, 0, 0), data: {} });
  scene.add({ kind: 'mark', layer: 'main', parent: group, pose: box(0, 0), data: { shape: 'rect' } });
  const inner = scene.add({ kind: 'group', layer: 'main', parent: group, pose: box(0, 0), data: {} });
  scene.add({ kind: 'mark', layer: 'main', parent: inner, pose: box(50, 50), data: { shape: 'rect' } });
  const hidden = scene.add({ kind: 'mark', layer: 'main', parent: inner, pose: box(300, 300), data: { shape: 'rect' } });
  scene.setHidden(hidden, true);
  const plain = scene.add({ kind: 'group', layer: 'main', pose: box(0, 0), data: {} });
  scene.add({ kind: 'mark', layer: 'main', parent: plain, pose: box(0, 0), data: { shape: 'rect' } });
  return { scene, group, inner, plain };
}

const boxes = (paths: readonly Path[]) => paths.map((p) => {
  const { x, y, width, height } = boundsOfPath(p);
  return [x, y, width, height];
});

describe('enteredOperandOutlines', () => {
  it('outlines each shown node under an entered boolean group, a group\'s members each on their own', () => {
    const { scene, group, inner } = makeScene();
    const expected = [[0, 0, 100, 100], [50, 50, 100, 100]];
    expect(boxes(enteredOperandOutlines(scene, group))).toEqual(expected);
    expect(boxes(enteredOperandOutlines(scene, inner))).toEqual(expected);
  });

  it('outlines nothing inside a group no boolean group holds', () => {
    const { scene, plain } = makeScene();
    expect(enteredOperandOutlines(scene, plain)).toEqual([]);
  });

  it('is drawn by the entered-group frame, in screen space, under the dashed frame', () => {
    const entered: EnteredGroupApi = { get: () => 'g' as never, enter: () => {}, leave: () => {}, leaveAll: () => {}, subscribe: () => () => {} };
    const layer = createEnteredGroupFrameLayer({
      entered, boundsOf: () => ({ x: 0, y: 0, width: 10, height: 10 }),
      outlinesOf: () => [{ kind: 'rect', x: 5, y: 5, width: 10, height: 10 }],
    });
    const cmds = layer.draw({}, { x: 10, y: 20, scale: { x: 2, y: 2 } }, { width: 200, height: 200, dpr: 1 }) as PathDrawCommand[];
    expect(cmds).toHaveLength(2);
    expect(cmds[0]!.stroke?.dash).toBeUndefined();
    expect(boundsOfPath(cmds[0]!.path)).toMatchObject({ x: -10, y: -30, width: 20, height: 20 });
    expect(cmds[1]!.stroke?.dash?.length).toBeGreaterThan(0);
  });
});
