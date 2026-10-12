import { describe, expect, it } from 'vitest';
import type { ActivePaint } from './ActiveSwatches';
import { activeInsertPaint } from './insertPaint';

const RED: ActivePaint = { kind: 'solid', color: '#ff0000ff' };
const BLUE: ActivePaint = { kind: 'solid', color: '#0000ffff' };
const NONE: ActivePaint = { kind: 'none' };

const red = { kind: 'solid', color: '#ff0000ff' };
const blue = { kind: 'solid', color: '#0000ffff' };

describe('activeInsertPaint', () => {
  it('gives a closed shape the active fill, and the active stroke 2 wide', () => {
    const paint = activeInsertPaint(() => ({ fill: RED, stroke: BLUE }));
    for (const kind of ['rect', 'ellipse', 'polygon', 'star', 'path']) {
      expect(paint(kind, 1), kind).toEqual({ fill: { paint: red }, stroke: { paint: blue, width: 2 } });
    }
  });

  it('gives a line or a pencil trail the active stroke and no fill', () => {
    const paint = activeInsertPaint(() => ({ fill: RED, stroke: BLUE }));
    expect(paint('line', 1)).toEqual({ fill: null, stroke: { paint: blue, width: 2 } });
    expect(paint('pencil', 1)).toEqual({ fill: null, stroke: { paint: blue, width: 2 } });
  });

  it('maps a paint of none to null, on either side', () => {
    expect(activeInsertPaint(() => ({ fill: NONE, stroke: BLUE }))('rect', 1)).toEqual({
      fill: null,
      stroke: { paint: blue, width: 2 },
    });
    expect(activeInsertPaint(() => ({ fill: RED, stroke: NONE }))('rect', 1)).toEqual({ fill: { paint: red }, stroke: null });
  });

  it('reads the paints at each insert, not when it was made', () => {
    let fill = RED;
    const paint = activeInsertPaint(() => ({ fill, stroke: NONE }));
    fill = BLUE;
    expect(paint('rect', 2).fill).toEqual({ paint: blue });
  });
});
