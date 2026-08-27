import { describe, it, expect } from 'vitest';
import { findNodeShape, findShapeInk } from './NodeShape';
import type { Node } from 'core/scene/types';
import type { PathDrawCommand } from '../renderer';
import type { FillStyle } from 'core/paint-types';
import { solid, strokeOf } from '../util/paint';

const POSE = { x: 0, y: 0, width: 100, height: 50 };
const RECT_PATH = { kind: 'rect' as const, x: 0, y: 0, width: 100, height: 50 };

const GRADIENT: FillStyle = {
  fill: 'linear-gradient',
  from: { x: 0, y: 0 },
  to: { x: 100, y: 0 },
  stops: [{ offset: 0, color: '#f00' }, { offset: 1, color: '#00f' }],
};

function node(data: Record<string, unknown>): Node<unknown, string, unknown> {
  return { id: 'n', pose: POSE, data } as unknown as Node<unknown, string, unknown>;
}

function paintOf(data: Record<string, unknown>): PathDrawCommand {
  const n = node(data);
  const entry = findNodeShape(n);
  if (!entry?.paint) throw new Error('no painter matched');
  return entry.paint(n, POSE)[0] as PathDrawCommand;
}

function inkOf(data: Record<string, unknown>) {
  return findShapeInk(node(data), POSE);
}

describe('kit:path accepts a FillStyle in data.fill', () => {
  it('passes a gradient straight through to the draw command', () => {
    expect(paintOf({ path: RECT_PATH, fill: GRADIENT }).fill).toEqual(GRADIENT);
  });

  it('passes a pattern through', () => {
    const pattern: FillStyle = { fill: 'pattern', pattern: { id: 'checker' } as never };
    expect(paintOf({ path: RECT_PATH, fill: pattern }).fill).toEqual(pattern);
  });

  it('takes a solid() paint as a solid color', () => {
    expect(paintOf({ path: RECT_PATH, fill: solid('#abc') }).fill).toEqual({ color: '#abc' });
  });

  it('skips the fill for null', () => {
    expect(paintOf({ path: RECT_PATH, fill: null }).fill).toBeUndefined();
  });

  it('falls back to the default fill when none is declared', () => {
    expect(paintOf({ path: RECT_PATH }).fill).toEqual({ color: '#888' });
  });

  it('still leaves a stroke-only path unfilled', () => {
    expect(paintOf({ path: RECT_PATH, stroke: strokeOf('#000', 2) }).fill).toBeUndefined();
  });

  it('fills a stroked path when a gradient is declared', () => {
    const cmd = paintOf({ path: RECT_PATH, fill: GRADIENT, stroke: strokeOf('#000', 2) });
    expect(cmd.fill).toEqual(GRADIENT);
    expect(cmd.stroke?.width).toBe(2);
  });
});

describe('ink() agrees with paint() about a FillStyle', () => {
  it('reports filled for a gradient, with or without a stroke', () => {
    expect(inkOf({ path: RECT_PATH, fill: GRADIENT })?.filled).toBe(true);
    expect(inkOf({ path: RECT_PATH, fill: GRADIENT, stroke: strokeOf('#000', 2) })?.filled).toBe(true);
  });

  it('keeps agreeing on the solid, null and absent cases', () => {
    for (const data of [
      { path: RECT_PATH, fill: solid('#abc') },
      { path: RECT_PATH, fill: null },
      { path: RECT_PATH },
      { path: RECT_PATH, stroke: strokeOf('#000', 2) },
    ]) {
      expect(inkOf(data)?.filled).toBe(paintOf(data).fill !== undefined);
    }
  });
});

describe('kit:shape accepts a FillStyle too', () => {
  it('passes a gradient through', () => {
    expect(paintOf({ shape: 'ellipse', fill: GRADIENT }).fill).toEqual(GRADIENT);
  });

  it('still defaults and still honours a solid paint', () => {
    expect(paintOf({ shape: 'ellipse' }).fill).toEqual({ color: '#888' });
    expect(paintOf({ shape: 'ellipse', fill: solid('#abc') }).fill).toEqual({ color: '#abc' });
  });

  it('skips the fill for null', () => {
    expect(paintOf({ shape: 'ellipse', fill: null }).fill).toBeUndefined();
  });
});
