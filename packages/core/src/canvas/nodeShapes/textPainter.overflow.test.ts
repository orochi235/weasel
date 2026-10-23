import { describe, it, expect, beforeEach, vi } from 'vitest';
import { registerFont, FIXTURE_FONT } from '@weasel-js/font';
import { _resetFontRegistryForTests } from '@weasel-js/font/test-seams';
import { _resetLayoutCacheForTests } from '@weasel-js/text/test-seams';
import { findNodeShape, shapeCoversPoint, _resetShapePaintersForTests } from '../NodeShape';
import { solid } from '../../util/paint';
import type { Node } from 'core/scene/types';
import type { DrawCommand } from '@weasel-js/renderer';

type Pose = { x: number; y: number; width: number; height: number };
const POSE: Pose = { x: 10, y: 20, width: 100, height: 40 };
// Four lines of 20 units in a box 40 tall: the last two hang below it. The
// fixture face has glyphs for `A` and `B` only, so the lines have width.
const TALL = { text: 'A\nB\nA\nB', style: { fontFamily: 'inter', fontSize: 16, lineHeight: 1.25 } };

function node(data: unknown): Node<unknown, 'default', Pose> {
  return { id: 'n', kind: 'mark', layer: 'default', pose: POSE, data, parent: null } as Node<unknown, 'default', Pose>;
}

const paint = (data: unknown): DrawCommand[] => {
  const n = node(data);
  return findNodeShape(n)!.paint(n, POSE);
};

beforeEach(async () => {
  _resetShapePaintersForTests();
  _resetFontRegistryForTests();
  global.fetch = vi.fn().mockImplementation((url: string) => Promise.resolve(url.endsWith('.json')
    ? { ok: true, json: () => Promise.resolve(FIXTURE_FONT) }
    : { ok: true, blob: () => Promise.resolve(new Blob([new TextEncoder().encode('PNG')], { type: 'image/png' })) },
  )) as typeof fetch;
  global.createImageBitmap = vi.fn().mockResolvedValue({ width: 512, height: 512, close: vi.fn() } as unknown as ImageBitmap);
  await registerFont('inter', {}, '/fonts/inter.json', '/fonts/inter.png');
  _resetLayoutCacheForTests();
});

describe('kit:text — overflow', () => {
  it('draws its text in a group clipped to the pose box when it clips', () => {
    const cmds = paint({ ...TALL, overflow: 'clip' });
    expect(cmds).toHaveLength(1);
    const g = cmds[0] as Extract<DrawCommand, { kind: 'group' }>;
    expect(g.kind).toBe('group');
    expect(g.clip).toEqual({ kind: 'rect', x: 10, y: 20, width: 100, height: 40 });
    expect(g.children.map((c) => c.kind)).toEqual(['text']);
  });

  it('keeps the background outside the clip, under it', () => {
    const cmds = paint({ ...TALL, overflow: 'clip', background: { paint: solid('#ffe97a') } });
    expect(cmds.map((c) => c.kind)).toEqual(['path', 'group']);
  });

  it('draws text unclipped by default and when it is visible', () => {
    expect(paint(TALL).map((c) => c.kind)).toEqual(['text']);
    expect(paint({ ...TALL, overflow: 'visible' }).map((c) => c.kind)).toEqual(['text']);
  });

  it('is not picked by the lines it clips away', () => {
    // Inside the third line's box, below the pose box.
    expect(shapeCoversPoint(node(TALL), POSE, 12, 65)).toBe(true);
    expect(shapeCoversPoint(node({ ...TALL, overflow: 'clip' }), POSE, 12, 65)).toBe(false);
    expect(shapeCoversPoint(node({ ...TALL, overflow: 'clip' }), POSE, 12, 25)).toBe(true);
  });
});
