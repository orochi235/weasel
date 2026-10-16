import { describe, expect, it } from 'vitest';
import type { Stroke } from '@weasel-js/paint';
import { PATH_L, PATH_M } from '@weasel-js/geom';
import { createScene } from 'core/scene/scene';
import { asNodeId, type RectPose } from 'core/scene/types';
import { drawnBoundsOf, inkExtentsOf } from './drawnBounds';

const RED = { kind: 'solid', color: '#f00' } as const;
const stroke = (s: Partial<Stroke> = {}): Stroke => ({ paint: RED, width: 10, ...s });

function sceneWith(nodes: { id: string; data: unknown; pose: RectPose; parent?: string; kind?: 'leaf' | 'container' }[]) {
  const scene = createScene<unknown, 'main', RectPose>({ systemLayers: [{ id: 'main' }] });
  for (const n of nodes) {
    scene.add({
      id: asNodeId(n.id), kind: n.kind ?? 'leaf', layer: 'main', data: n.data, pose: n.pose,
      ...(n.parent ? { parent: asNodeId(n.parent) } : {}),
    } as never);
  }
  return scene;
}

const BOX: RectPose = { x: 0, y: 0, width: 100, height: 100 };

function boxOf(data: unknown, pose: RectPose = BOX, opts: { includeStroke?: boolean; scale?: number } = {}) {
  const scene = sceneWith([{ id: 'a', data, pose }]);
  return drawnBoundsOf(scene, asNodeId('a'), pose, opts);
}

describe('drawnBoundsOf', () => {
  it('is the pose box for a node with no stroke', () => {
    expect(boxOf({ shape: 'rect' })).toEqual(BOX);
  });

  it('grows a rect by half a centered stroke', () => {
    expect(boxOf({ shape: 'rect', stroke: stroke() })).toEqual({ x: -5, y: -5, width: 110, height: 110 });
  });

  it('honors the stroke align', () => {
    expect(boxOf({ shape: 'rect', stroke: stroke({ align: 'inner' }) })).toEqual(BOX);
    expect(boxOf({ shape: 'ellipse', stroke: stroke({ align: 'outer' }) }))
      .toEqual({ x: -10, y: -10, width: 120, height: 120 });
  });

  it('resolves a screen-pixel width at the view scale', () => {
    expect(boxOf({ shape: 'rect', stroke: stroke({ width: { px: 10 } }) }, BOX, { scale: 2 }))
      .toEqual({ x: -2.5, y: -2.5, width: 105, height: 105 });
  });

  it('reads a variable-width stroke at its widest', () => {
    expect(boxOf({ shape: 'rect', stroke: stroke({ width: 2, vertexWidths: [2, 20, 2, 2] }) }))
      .toEqual({ x: -10, y: -10, width: 120, height: 120 });
  });

  it('is the pose box when stroke is opted out', () => {
    expect(boxOf({ shape: 'rect', stroke: stroke() }, BOX, { includeStroke: false })).toEqual(BOX);
  });

  it('keeps a turned node oriented, grown in its own frame', () => {
    const turned = { ...BOX, rotation: Math.PI / 4 };
    expect(boxOf({ shape: 'rect', stroke: stroke() }, turned))
      .toEqual({ x: -5, y: -5, width: 110, height: 110, rotation: Math.PI / 4 });
  });

  it('covers a miter spike on a path exactly', () => {
    // A V whose tip points down: a miter join reaches below the tip by
    // half the width over the sine of the half angle.
    const path = {
      kind: 'polygon' as const,
      commands: new Uint8Array([PATH_M, PATH_L, PATH_L]),
      coords: new Float32Array([0, 0, 50, 100, 100, 0]),
      fillRule: 'nonzero' as const,
    };
    const b = boxOf({ path, fill: null, stroke: stroke({ width: 10, join: 'miter', miterLimit: 10, cap: 'butt' }) });
    const half = Math.atan2(50, 100);
    expect(b.y + b.height).toBeCloseTo(100 + 5 / Math.sin(half), 3);
    // Each butt end is square to its slanted leg, so a corner rises above it.
    expect(b.y).toBeCloseTo(-5 * 50 / Math.hypot(50, 100), 3);
  });

  it('boxes a group around its members as drawn', () => {
    const scene = sceneWith([
      { id: 'g', kind: 'container', data: {}, pose: { x: 0, y: 0, width: 200, height: 100 } },
      { id: 'a', parent: 'g', data: { shape: 'rect', stroke: stroke() }, pose: BOX },
      { id: 'b', parent: 'g', data: { shape: 'rect' }, pose: { x: 100, y: 0, width: 100, height: 100 } },
    ]);
    const g = asNodeId('g');
    expect(drawnBoundsOf(scene, g, scene.get(g)!.pose)).toEqual({ x: -5, y: -5, width: 205, height: 110 });
  });
});

describe('inkExtentsOf', () => {
  it('is zero for an unstroked node', () => {
    const scene = sceneWith([{ id: 'a', data: { shape: 'rect' }, pose: BOX }]);
    expect(inkExtentsOf(scene, asNodeId('a'), BOX)).toEqual({ left: 0, top: 0, right: 0, bottom: 0 });
  });
});
