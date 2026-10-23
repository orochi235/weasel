import { describe, it, expect, beforeEach } from 'vitest';
import { findNodeShape, findShapeSilhouette, shapeCoversPoint, _resetShapePaintersForTests } from '../NodeShape';
import { solid } from '../../util/paint';
import type { Node } from 'core/scene/types';
import type { DrawCommand } from '@weasel-js/renderer';
import { textBoxOf, textPoseOf } from './textPainter';

type Pose = { x: number; y: number; width: number; height: number };
const POSE: Pose = { x: 10, y: 20, width: 100, height: 80 };

function node(data: unknown, pose: Pose = POSE): Node<unknown, 'default', Pose> {
  return { id: 'n', kind: 'mark', layer: 'default', pose, data, parent: null } as Node<unknown, 'default', Pose>;
}

const paint = (data: unknown): DrawCommand[] => {
  const n = node(data);
  return findNodeShape(n)!.paint(n, POSE);
};

beforeEach(() => _resetShapePaintersForTests());

describe('kit:text — a background and padding', () => {
  it('paints the background over the whole pose box, under the glyphs', () => {
    const cmds = paint({ text: 'hi', background: { paint: solid('#ffe97a') } });
    expect(cmds.map((c) => c.kind)).toEqual(['path', 'text']);
    const bg = cmds[0] as Extract<DrawCommand, { kind: 'path' }>;
    expect(bg.path).toEqual({ kind: 'rect', x: 10, y: 20, width: 100, height: 80 });
    expect(bg.fill).toBeDefined();
  });

  it('paints no box when it has no background, or a null one', () => {
    expect(paint({ text: 'hi' }).map((c) => c.kind)).toEqual(['text']);
    expect(paint({ text: 'hi', background: null }).map((c) => c.kind)).toEqual(['text']);
  });

  it('lays the text out in the box inset by the padding', () => {
    const [, text] = paint({ text: 'hi', background: { paint: solid('#ffe97a') }, padding: 12 });
    const t = text as Extract<DrawCommand, { kind: 'text' }>;
    expect(t.x).toBe(22);
    expect(t.y).toBe(32);
    expect(t.height).toBe(56);
  });

  it('insets text with no background too: padding is layout, not paint', () => {
    expect(textBoxOf({ padding: 5 }, POSE)).toEqual({ x: 15, y: 25, width: 90, height: 70 });
    expect(textPoseOf({ text: 'a', padding: 5 }, POSE)).toMatchObject({ x: 15, y: 25, width: 90, height: 70 });
  });

  it('never insets past the box center', () => {
    expect(textBoxOf({ padding: 70 }, POSE)).toEqual({ x: 60, y: 60, width: 0, height: 0 });
  });

  it('is picked anywhere in its box when it has a background, even with no text', () => {
    const n = node({ text: '', background: { paint: solid('#ffe97a') } });
    expect(findShapeSilhouette(n, POSE)).toEqual({ kind: 'rect', x: 10, y: 20, width: 100, height: 80 });
    expect(shapeCoversPoint(n, POSE, 105, 95)).toBe(true);
  });

  it('keeps a bare text node picked by its line boxes', () => {
    const n = node({ text: '' });
    expect(findShapeSilhouette(n, POSE)).toBeNull();
  });
});

describe('kit:text — the glyph fill', () => {
  const runFills = (data: unknown) =>
    (paint(data).find((c) => c.kind === 'text') as Extract<DrawCommand, { kind: 'text' }>).runs.map((r) => r.fill ?? null);

  it('paints no glyphs when the node has no fill, a null one, or one with no paint', () => {
    expect(runFills({ text: 'hi' })).toEqual([null]);
    expect(runFills({ text: 'hi', fill: null })).toEqual([null]);
    expect(runFills({ text: 'hi', fill: {} })).toEqual([null]);
  });

  it('paints the glyphs with the fill the node names', () => {
    expect(runFills({ text: 'hi', fill: { paint: solid('#000') } })).toEqual([{ paint: solid('#000') }]);
  });
});
