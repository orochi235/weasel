import { describe, expect, it } from 'vitest';
import type { Stroke } from '@weasel-js/paint';
import { PATH_L, PATH_M, PATH_Z, type Scale2 } from '@weasel-js/geom';
import { createScene } from 'core/scene/scene';
import { asNodeId, type RectPose } from 'core/scene/types';
import { polylineFromPoints, type Path } from '@weasel-js/geom';
import { drawnBoundsOf, inkExtentsOf } from './drawnBounds';
import { drawnBoundsScene } from './derivedPath';

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

function boxOf(data: unknown, pose: RectPose = BOX, opts: { includeStroke?: boolean; scale?: number | Scale2 } = {}) {
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

describe('drawnBoundsOf, a { px } stroke on screen', () => {
  const STRETCH = { x: 4, y: 1 };

  it('outsets each side by the stroke as it lands on screen under a stretched view', () => {
    expect(boxOf({ shape: 'rect', stroke: stroke({ width: { px: 10 } }) }, BOX, { scale: STRETCH }))
      .toEqual({ x: -1.25, y: -5, width: 102.5, height: 110 });
  });

  it('measures across a skewing transform', () => {
    const skewed = { ...BOX, transform: [1, 0, 1, 1] as const };
    const b = boxOf({ shape: 'ellipse', stroke: stroke({ width: { px: 10 } }) }, skewed, { scale: { x: 1, y: 1 } });
    // Across the slanted sides a pixel is √2 units of the box's own x.
    expect(b.x).toBeCloseTo(-5 * Math.SQRT2, 9);
    expect(b.width).toBeCloseTo(100 + 10 * Math.SQRT2, 9);
    expect(b).toMatchObject({ y: -5, height: 110, transform: [1, 0, 1, 1] });
  });

  it('builds a path\'s ribbon in screen space', () => {
    const square = {
      kind: 'polygon' as const,
      commands: new Uint8Array([PATH_M, PATH_L, PATH_L, PATH_L, PATH_Z]),
      coords: new Float32Array([0, 0, 100, 0, 100, 100, 0, 100]),
      fillRule: 'nonzero' as const,
    };
    const b = boxOf({ path: square, fill: null, stroke: stroke({ width: { px: 8 }, join: 'miter' }) }, BOX, { scale: STRETCH });
    expect(b.x).toBeCloseTo(-1, 4);
    expect(b.y).toBeCloseTo(-4, 4);
    expect(b.width).toBeCloseTo(102, 4);
    expect(b.height).toBeCloseTo(108, 4);
  });
});

describe('inkExtentsOf', () => {
  it('is zero for an unstroked node', () => {
    const scene = sceneWith([{ id: 'a', data: { shape: 'rect' }, pose: BOX }]);
    expect(inkExtentsOf(scene, asNodeId('a'), BOX)).toEqual({ left: 0, top: 0, right: 0, bottom: 0 });
  });
});

describe('drawnBoundsOf a node showing a derived path', () => {
  /** Two anchors far from the origin, and an edge between them whose own pose is a 0x0 placeholder at the origin. */
  function edgeScene(data: unknown) {
    const scene = createScene<unknown, 'main', RectPose>({ systemLayers: [{ id: 'main' }] });
    const a = scene.add({ kind: 'leaf', layer: 'main', data: {}, pose: { x: 300, y: 200, width: 10, height: 10 } });
    const b = scene.add({ kind: 'leaf', layer: 'main', data: {}, pose: { x: 500, y: 260, width: 10, height: 10 } });
    const edge = scene.add({
      kind: 'leaf', layer: 'main', data, pose: { x: 0, y: 0, width: 0, height: 0 }, dependsOn: [a, b],
      derivePath: (_n, deps): Path | null => {
        const [from, to] = [deps[0]?.pose, deps[1]?.pose];
        return from && to ? polylineFromPoints([{ x: from.x, y: from.y }, { x: to.x, y: to.y }]) : null;
      },
    });
    return { scene, edge };
  }

  it('boxes the path, not the placeholder pose', () => {
    const { scene, edge } = edgeScene({});
    expect(drawnBoundsOf(drawnBoundsScene(scene), edge, scene.get(edge)!.pose)).toEqual({ x: 300, y: 200, width: 200, height: 60 });
  });

  it('grows the path box by its stroke', () => {
    const { scene, edge } = edgeScene({ stroke: stroke({ width: 4 }) });
    const box = drawnBoundsOf(drawnBoundsScene(scene), edge, scene.get(edge)!.pose);
    expect(box.x).toBeLessThan(300);
    expect(box.x).toBeGreaterThan(290);
    expect(box.y + box.height).toBeGreaterThan(260);
    expect(box.y + box.height).toBeLessThan(270);
  });

  it('falls back to the pose box for a scene that reads no derived paths', () => {
    const { scene, edge } = edgeScene({});
    expect(drawnBoundsOf(scene, edge, scene.get(edge)!.pose)).toEqual({ x: 0, y: 0, width: 0, height: 0 });
  });
});
