import { beforeEach, describe, expect, it, vi } from 'vitest';
import { registerFont, FIXTURE_FONT } from '@weasel-js/font';
import { _resetFontRegistryForTests } from '@weasel-js/font/test-seams';
import { _resetLayoutCacheForTests } from '@weasel-js/text/test-seams';
import { textLineBoxes } from '@weasel-js/text';
import { createScene } from 'core/scene/scene';
import { asNodeId, type RectPose } from 'core/scene/types';
import { drawnBoundsOf } from '../drawnBounds';
import { textPoseOf, type TextNodeData } from './textPainter';

const RED = { kind: 'solid', color: '#f00' } as const;
const STYLE = { fontFamily: 'inter', fontSize: 32 };

beforeEach(async () => {
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

function drawn(data: TextNodeData, pose: RectPose, scale?: number) {
  const scene = createScene<unknown, 'main', RectPose>({ systemLayers: [{ id: 'main' }] });
  scene.add({ id: asNodeId('t'), kind: 'mark', layer: 'main', data, pose } as never);
  return drawnBoundsOf(scene, asNodeId('t'), pose, scale === undefined ? {} : { scale });
}

describe('kit:text drawn bounds', () => {
  const pose = { x: 0, y: 0, width: 400, height: 200 };

  it('is the pose box with no stroke', () => {
    expect(drawn({ text: 'AB', style: STYLE }, pose)).toEqual(pose);
  });

  it('reaches past the layout box where a stroked line touches its edge', () => {
    const box = drawn({ text: 'AB', style: STYLE, stroke: { paint: RED, width: 10 } }, pose);
    // The line starts on the left edge and the top, and ends well short of the
    // right and the bottom, which keep the layout box's edges.
    expect(box).toEqual({ x: -5, y: -5, width: 405, height: 205 });
  });

  it('grows the right edge by the stroke when the line fills the width', () => {
    const data = { text: 'AB', style: STYLE, stroke: { paint: RED, width: 10 } };
    const [line] = textLineBoxes(textPoseOf(data, pose));
    const tight = { x: 0, y: 0, width: line!.width, height: 200 };
    expect(drawn(data, tight)).toEqual({ x: -5, y: -5, width: line!.width + 10, height: 205 });
  });

  it('resolves a screen-pixel stroke at the view scale', () => {
    const box = drawn({ text: 'AB', style: STYLE, stroke: { paint: RED, width: { px: 8 } } }, pose, 2);
    expect(box).toEqual({ x: -2, y: -2, width: 402, height: 202 });
  });
});
