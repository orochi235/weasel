import { describe, it, expect } from 'vitest';
import type { DrawCommand } from '@weasel-js/renderer';
import { INHERIT, type Fill, type Stroke } from '@weasel-js/paint';
import { pathFromParts, type DerivedPart } from 'core/scene/derivedParts';
import { solid, strokeOf } from '../../util/paint';
import { DERIVED_PAINTER } from './derivedPainter';

const RECT = { kind: 'rect', x: 0, y: 0, width: 10, height: 10 } as const;
const NODE_FILL: Fill = { paint: solid('#ff0000') };
const NODE_STROKE: Stroke = strokeOf('#0000ff', 2);

function paintParts(parts: DerivedPart[]) {
  const node = { id: 'n', data: { fill: NODE_FILL, stroke: NODE_STROKE }, dependsOn: ['a'] };
  const cmds = DERIVED_PAINTER.paint(node as never, { x: 0, y: 0, width: 0, height: 0 } as never, {
    derivedPath: pathFromParts(parts)!,
  } as never) as Extract<DrawCommand, { kind: 'path' }>[];
  return cmds.map((c) => ({ fill: c.fill?.paint ?? null, stroke: c.stroke?.paint ?? null }));
}

describe('kit:derived — a part with paint of its own', () => {
  it('paints nothing for a part that names no fill or stroke', () => {
    expect(paintParts([{ path: RECT }])).toEqual([{ fill: null, stroke: null }]);
  });

  it("takes the node's fill and stroke for a part that inherits them", () => {
    expect(paintParts([{ path: RECT, fill: INHERIT, stroke: INHERIT }]))
      .toEqual([{ fill: NODE_FILL.paint, stroke: NODE_STROKE.paint }]);
  });

  it('paints its own fill over the node\'s, and none for null', () => {
    const own = { paint: solid('#00ff00') };
    expect(paintParts([{ path: RECT, fill: own, stroke: null }])).toEqual([{ fill: own.paint, stroke: null }]);
  });
});
