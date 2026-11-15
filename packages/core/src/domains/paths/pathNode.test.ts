import { describe, expect, it } from 'vitest';
import { solid } from '../../util/paint';
import { pathFromD, rectPath } from '@weasel-js/geom';
import { createScene } from 'core/scene/scene';
import type { RectPose } from 'core/geometry/rectPose';
import { pathNode } from './pathNode';

const D = 'M10 20 L50 20 L50 60 Z';

describe('pathNode', () => {
  it('is a mark holding the path in data, posed at the path\'s bounds on the default layer', () => {
    const fill = { paint: solid('#f00') };
    expect(pathNode('a', D, { fill })).toEqual({
      kind: 'mark', id: 'a', layer: 'default',
      pose: { x: 10, y: 20, width: 40, height: 40 },
      data: { path: pathFromD(D), fill },
    });
  });

  it('takes a built path and keeps every data field it is given', () => {
    const path = rectPath(0, 0, 8, 4);
    const node = pathNode('r', path, { stroke: { paint: solid('#000'), width: 2 }, vertexColors: [1, 2] });
    expect(node.data).toEqual({ path, stroke: { paint: solid('#000'), width: 2 }, vertexColors: [1, 2] });
    expect(node.pose).toEqual({ x: 0, y: 0, width: 8, height: 4 });
  });

  it('holds the path it is given over one the data carries', () => {
    expect(pathNode('a', D, { path: rectPath(0, 0, 1, 1) }).data.path).toEqual(pathFromD(D));
  });

  it('places it as told: layer, parent, a turn about its box, its own box, and the stated node fields', () => {
    const node = pathNode('p', D, {}, { layer: 'ink', parent: 'g', rotation: 0.5, pickable: false });
    expect(node).toMatchObject({ layer: 'ink', parent: 'g', pickable: false, pose: { x: 10, y: 20, width: 40, height: 40, rotation: 0.5 } });
    expect(pathNode('q', D, {}, { pose: { x: 0, y: 0, width: 4, height: 4 } }).pose).toEqual({ x: 0, y: 0, width: 4, height: 4 });
  });

  it('is what a scene takes as an initial node', () => {
    const scene = createScene<unknown, 'default', RectPose>({ systemLayers: [{ id: 'default' }], initial: [pathNode('a', D)] });
    expect(scene.get(pathNode('a', D).id)?.pose).toEqual({ x: 10, y: 20, width: 40, height: 40 });
  });
});
