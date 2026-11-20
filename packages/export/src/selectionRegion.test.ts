import { describe, expect, it } from 'vitest';
import { asNodeId, createScene, type RectPose } from '@weasel-js/core';
import { solidFill } from '@weasel-js/paint';
import { plainScene } from './testing/plainScene';
import { selectionRegion } from './selectionRegion';

describe('selectionRegion leaves out what no export draws', () => {
  it('drops a node on an annotation layer, and answers null when that is all there is', () => {
    const { scene } = plainScene();
    expect(selectionRegion(scene, ['n'])).toBeNull();
    expect(selectionRegion(scene, ['r', 'n'])).toEqual({ x: 20, y: 20, width: 60, height: 40 });
  });

  it('drops a hidden node and a node on a hidden layer', () => {
    const { scene } = plainScene();
    scene.setHidden(asNodeId('e'), true);
    expect(selectionRegion(scene, ['e'])).toBeNull();
    expect(selectionRegion(scene, ['r', 'e'])).toEqual({ x: 20, y: 20, width: 60, height: 40 });
  });

  it('drops a node on a hidden layer, but boxes what its children draw', () => {
    const scene = createScene<unknown, 'main' | 'off', RectPose>({ systemLayers: [{ id: 'off', visible: false }, { id: 'main' }] });
    scene.add({ id: 'g', kind: 'group', layer: 'off', parent: null, pose: { x: 0, y: 0, width: 100, height: 100 }, data: {} } as never);
    scene.add({ id: 'c', kind: 'mark', layer: 'main', parent: 'g', pose: { x: 10, y: 10, width: 20, height: 20 }, data: { shape: 'rect', fill: solidFill('#f00') } } as never);
    scene.add({ id: 'o', kind: 'mark', layer: 'off', parent: null, pose: { x: 200, y: 0, width: 5, height: 5 }, data: { shape: 'rect', fill: solidFill('#f00') } } as never);
    expect(selectionRegion(scene, ['o'])).toBeNull();
    expect(selectionRegion(scene, ['g', 'o'])).toEqual({ x: 10, y: 10, width: 20, height: 20 });
  });
});

describe('selectionRegion at an export scale', () => {
  it('measures a screen-pixel stroke at the scale the export draws it', () => {
    const { scene } = plainScene();
    scene.update(asNodeId('r'), { data: { ...(scene.get(asNodeId('r'))!.data as object), stroke: { paint: solidFill('#000'), width: { px: 10 } } } });
    // 10 output px at scale 0.5 is 20 world units: a half-width of 10 past each edge.
    expect(selectionRegion(scene, ['r'], { scale: 0.5 })).toEqual({ x: 10, y: 10, width: 80, height: 60 });
    expect(selectionRegion(scene, ['r'], { scale: 2, name: 'S' })).toEqual({ x: 17.5, y: 17.5, width: 65, height: 45, name: 'S' });
  });
});
