import { beforeEach, describe, expect, it, vi } from 'vitest';
import { registerFont, FIXTURE_FONT } from '@weasel-js/font';
import { _resetFontRegistryForTests } from '@weasel-js/font/test-seams';
import { _resetLayoutCacheForTests } from '@weasel-js/text/test-seams';
import { textLineBoxes } from '@weasel-js/text';
import type { DrawCommand } from '@weasel-js/renderer';
import { createScene } from 'core/scene/scene';
import { asNodeId, type Node, type RectPose } from 'core/scene/types';
import { findNodeShape, findShapeSilhouette, shapeCoversPoint, _resetShapePaintersForTests } from '../NodeShape';
import { defaultDrawOne } from '../defaultDrawOne';
import { drawnBoundsOf } from '../drawnBounds';
import { textPoseOf, type TextNodeData } from './textPainter';

const RED = { kind: 'solid', color: '#f00' } as const;
const POSE: RectPose = { x: 0, y: 0, width: 400, height: 200 };
const PX = { fontFamily: 'inter', fontSize: { px: 20 } };

beforeEach(async () => {
  _resetShapePaintersForTests();
  _resetFontRegistryForTests();
  _resetLayoutCacheForTests();
  const encoder = new TextEncoder();
  global.fetch = vi.fn().mockImplementation((url: string) => {
    if (url.endsWith('.json')) return Promise.resolve({ ok: true, json: () => Promise.resolve(FIXTURE_FONT) });
    return Promise.resolve({ ok: true, blob: () => Promise.resolve(new Blob([encoder.encode('PNG')], { type: 'image/png' })) });
  }) as typeof fetch;
  global.createImageBitmap = vi.fn().mockResolvedValue({ width: 512, height: 512, close: vi.fn() } as unknown as ImageBitmap);
  await registerFont('inter', {}, '/fonts/inter.json', '/fonts/inter.png');
  _resetLayoutCacheForTests();
});

function node(data: TextNodeData, pose: RectPose = POSE): Node<unknown, 'main', RectPose> {
  return { id: asNodeId('t'), kind: 'mark', layer: 'main', pose, data, parent: null } as Node<unknown, 'main', RectPose>;
}

const textOf = (cmds: DrawCommand[]) => cmds.find((c) => c.kind === 'text') as Extract<DrawCommand, { kind: 'text' }>;

describe('kit:text — a { px } font size', () => {
  it('paints at the view scale the paint ctx carries', () => {
    const n = node({ text: 'AB', style: PX });
    expect(textOf(findNodeShape(n)!.paint(n, POSE, { scale: 2 })).runs[0]!.fontSize).toBe(10);
    expect(textOf(findNodeShape(n)!.paint(n, POSE, { scale: 4 })).runs[0]!.fontSize).toBe(5);
  });

  it('keeps its memo while the scale holds, and a world size keeps it at any scale', () => {
    const px = node({ text: 'AB', style: PX });
    const painter = findNodeShape(px)!;
    expect(painter.paint(px, POSE, { scale: 2 })).toBe(painter.paint(px, POSE, { scale: 2 }));
    const world = node({ text: 'AB', style: { fontFamily: 'inter', fontSize: 20 } });
    expect(painter.paint(world, POSE, { scale: 2 })).toBe(painter.paint(world, POSE, { scale: 4 }));
  });

  it('is sized by the view defaultDrawOne paints at', () => {
    const n = node({ text: 'AB', style: PX });
    const cmds = defaultDrawOne(n, POSE, { x: 0, y: 0, scale: { x: 2, y: 2 } });
    expect(textOf(cmds).runs[0]!.fontSize).toBe(10);
  });

  it('is sized by the view defaultDrawOne paints at when the caller\'s ctx states no density', () => {
    const n = node({ text: 'AB', style: PX });
    const cmds = defaultDrawOne(n, POSE, { x: 0, y: 0, scale: { x: 2, y: 2 } }, {});
    expect(textOf(cmds).runs[0]!.fontSize).toBe(10);
  });

  it('reports the line boxes it draws as its silhouette', () => {
    const data = { text: 'AB', style: PX };
    const at2 = findShapeSilhouette(node(data), POSE, { scale: 2 });
    const [line] = textLineBoxes(textPoseOf(data, POSE), { scale: 2 });
    expect(at2).toMatchObject({ kind: 'polygon' });
    const coords = (at2 as { coords: Float32Array }).coords;
    expect(coords[2]).toBeCloseTo(line!.x + line!.width);
    expect(findShapeSilhouette(node(data), POSE, { scale: 1 })).not.toEqual(at2);
  });

  it('is picked where its lines are at the view scale', () => {
    const data = { text: 'AB', style: PX };
    const [full] = textLineBoxes(textPoseOf(data, POSE));
    const x = full!.width * 0.75;
    const y = full!.height * 0.25;
    expect(shapeCoversPoint(node(data), POSE, x, y, { scale: 1 })).toBe(true);
    expect(shapeCoversPoint(node(data), POSE, x, y, { scale: 2 })).toBe(false);
  });

  it('bounds a stroked line by its width at the view scale', () => {
    const data = { text: 'AB', style: PX, stroke: { paint: RED, width: 10 } };
    const [line] = textLineBoxes(textPoseOf(data, POSE));
    const tight = { x: 0, y: 0, width: line!.width, height: 200 };
    const scene = createScene<unknown, 'main', RectPose>({ systemLayers: [{ id: 'main' }] });
    scene.add({ id: asNodeId('t'), kind: 'mark', layer: 'main', data, pose: tight });
    // At scale 2 the line is half as wide, so it no longer reaches the right edge.
    expect(drawnBoundsOf(scene, asNodeId('t'), tight, { scale: 2 }))
      .toEqual({ x: -5, y: -5, width: line!.width + 5, height: 205 });
  });
});
