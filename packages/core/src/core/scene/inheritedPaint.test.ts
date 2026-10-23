import { describe, expect, it } from 'vitest';
import { INHERIT, type PaintedFill, type PaintedStroke } from '@weasel-js/paint';
import { inheritedPaintOf, inheritsPaint } from './inheritedPaint';

const RED: PaintedFill = { paint: { kind: 'solid', color: '#f00' } };
const BLUE: PaintedFill = { paint: { kind: 'solid', color: '#00f' } };
const LINE: PaintedStroke = { paint: { kind: 'solid', color: '#000' }, width: 2 };

const group = (data: object) => ({ kind: 'group', data });

describe('inheritsPaint', () => {
  it('is true only for a node whose fill or stroke is the inherit marker', () => {
    expect(inheritsPaint({ data: { fill: INHERIT } })).toBe(true);
    expect(inheritsPaint({ data: { stroke: INHERIT } })).toBe(true);
    expect(inheritsPaint({ data: { fill: RED } })).toBe(false);
    expect(inheritsPaint({ data: {} })).toBe(false);
    expect(inheritsPaint({ data: null })).toBe(false);
    expect(inheritsPaint({})).toBe(false);
  });
});

describe('inheritedPaintOf', () => {
  it('takes the nearest enclosing container’s fill and stroke, whole', () => {
    const node = { data: { fill: INHERIT, stroke: INHERIT } };
    const got = inheritedPaintOf(node, [group({ fill: RED, stroke: LINE }), group({ fill: BLUE })]);
    expect(got.fill).toBe(RED);
    expect(got.stroke).toBe(LINE);
  });

  it('walks on past a container that inherits too', () => {
    const node = { data: { fill: INHERIT } };
    expect(inheritedPaintOf(node, [group({ fill: INHERIT }), group({ fill: BLUE })]).fill).toBe(BLUE);
  });

  it('takes a mark ancestor’s fill like a group’s', () => {
    const node = { data: { fill: INHERIT } };
    expect(inheritedPaintOf(node, [{ kind: 'mark', data: { fill: RED } }, group({ fill: BLUE })]).fill)
      .toBe(RED);
  });

  it('is none at the root, and under a container with none', () => {
    const node = { data: { fill: INHERIT, stroke: INHERIT } };
    expect(inheritedPaintOf(node, [])).toEqual({ fill: null, stroke: null });
    expect(inheritedPaintOf(node, [group({}), group({ fill: RED, stroke: LINE })]))
      .toEqual({ fill: null, stroke: null });
    expect(inheritedPaintOf(node, [group({ fill: { opacity: 1 } })]).fill).toBeNull();
  });

  it('runs out as none when every container above inherits', () => {
    const node = { data: { fill: INHERIT } };
    expect(inheritedPaintOf(node, [group({ fill: INHERIT })]).fill).toBeNull();
  });

  it('leaves a field the node does not inherit as none', () => {
    const node = { data: { fill: INHERIT, stroke: LINE } };
    expect(inheritedPaintOf(node, [group({ fill: RED, stroke: LINE })]).stroke).toBeNull();
  });

  it('hands back the same object while its sources are unchanged, and a new one when they change', () => {
    const node = { data: { fill: INHERIT } };
    const first = inheritedPaintOf(node, [group({ fill: RED })]);
    expect(inheritedPaintOf(node, [group({ fill: RED })])).toBe(first);
    const changed = inheritedPaintOf(node, [group({ fill: BLUE })]);
    expect(changed).not.toBe(first);
    expect(changed.fill).toBe(BLUE);
  });
});

describe('withInheritedPaint', () => {
  it('replaces only the fields that inherit, and hands back data that inherits nothing', async () => {
    const { withInheritedPaint } = await import('./inheritedPaint');
    const plain = { fill: RED };
    expect(withInheritedPaint(plain, undefined)).toBe(plain);
    expect(withInheritedPaint({ fill: INHERIT, stroke: LINE }, { fill: BLUE, stroke: null }))
      .toEqual({ fill: BLUE, stroke: LINE });
    expect(withInheritedPaint({ stroke: INHERIT }, undefined)).toEqual({ stroke: null });
  });
});
