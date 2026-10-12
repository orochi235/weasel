import { describe, expect, it } from 'vitest';
import type { ActivePaint } from './ActiveSwatches';
import { activeInsertPaint } from './insertPaint';

const RED: ActivePaint = { kind: 'solid', color: '#ff0000ff' };
const BLUE: ActivePaint = { kind: 'solid', color: '#0000ffff' };
const NONE: ActivePaint = null;

describe('activeInsertPaint', () => {
  it('gives a closed shape the active fill, and the active stroke 2 wide', () => {
    const paint = activeInsertPaint(() => ({ fill: RED, stroke: BLUE }), () => 'nonzero');
    for (const kind of ['rect', 'ellipse', 'polygon', 'star', 'path']) {
      expect(paint(kind, 1), kind).toEqual({ fill: { paint: RED }, stroke: { paint: BLUE, width: 2 }, fillRule: 'nonzero' });
    }
  });

  it('gives a line or a pencil trail the active stroke and no fill', () => {
    const paint = activeInsertPaint(() => ({ fill: RED, stroke: BLUE }), () => 'nonzero');
    expect(paint('line', 1)).toEqual({ fill: null, stroke: { paint: BLUE, width: 2 }, fillRule: 'nonzero' });
    expect(paint('pencil', 1)).toEqual({ fill: null, stroke: { paint: BLUE, width: 2 }, fillRule: 'nonzero' });
  });

  it('passes no paint through, on either side', () => {
    expect(activeInsertPaint(() => ({ fill: NONE, stroke: BLUE }), () => 'nonzero')('rect', 1)).toEqual({
      fill: null,
      stroke: { paint: BLUE, width: 2 },
      fillRule: 'nonzero',
    });
    expect(activeInsertPaint(() => ({ fill: RED, stroke: NONE }), () => 'nonzero')('rect', 1)).toEqual({ fill: { paint: RED }, stroke: null, fillRule: 'nonzero' });
  });

  it('names the fill rule a new path takes, read at each insert', () => {
    let rule: 'nonzero' | 'evenodd' = 'nonzero';
    const paint = activeInsertPaint(() => ({ fill: RED, stroke: NONE }), () => rule);
    expect(paint('pencil', 1).fillRule).toBe('nonzero');
    rule = 'evenodd';
    expect(paint('pencil', 2).fillRule).toBe('evenodd');
  });

  it('reads the paints at each insert, not when it was made', () => {
    let fill = RED;
    const paint = activeInsertPaint(() => ({ fill, stroke: NONE }), () => 'nonzero');
    fill = BLUE;
    expect(paint('rect', 2).fill?.paint).toBe(BLUE);
  });
});
