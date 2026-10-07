import { describe, it, expect } from 'vitest';
import { findNodeShape } from './NodeShape';
import { PATH_M, PATH_L, type PolygonPath } from '@weasel-js/geom';

const LINE: PolygonPath = {
  kind: 'polygon',
  commands: new Uint8Array([PATH_M, PATH_L]),
  coords: new Float32Array([0, 0, 100, 0]),
  fillRule: 'nonzero',
};
const POSE = { x: 0, y: 0, w: 100, h: 1, rotation: 0 };

function nodeWith(stroke: unknown) {
  return { id: 'n1', data: { path: LINE, fill: null, stroke } } as never;
}

describe('markers on a path node', () => {
  it('emits only the stroke command when no marker is set', () => {
    const node = nodeWith({ paint: { fill: 'solid', color: '#000' }, width: 2 });
    const cmds = findNodeShape(node)!.paint!(node, POSE as never, {} as never);
    expect(cmds).toHaveLength(1);
  });

  // The renderer draws the head, where the view scale a `{ px }` size needs
  // is known; a painter only passes the marker through on its stroke.
  it('leaves the marker on the stroke for the renderer to draw', () => {
    const node = nodeWith({ paint: { fill: 'solid', color: '#000' }, width: 2, markerEnd: 'arrow' });
    const cmds = findNodeShape(node)!.paint!(node, POSE as never, {} as never);
    expect(cmds).toHaveLength(1);
    expect((cmds[0] as { stroke?: { markerEnd?: unknown } }).stroke?.markerEnd).toBe('arrow');
  });

  it('reaches past the path end for hit-testing', () => {
    const plain = nodeWith({ paint: { fill: 'solid', color: '#000' }, width: 2 });
    const marked = nodeWith({
      paint: { fill: 'solid', color: '#000' }, width: 2, markerEnd: 'arrow',
    });
    const inkOf = (n: unknown) =>
      findNodeShape(n as never)!.ink!(n as never, POSE as never, { scale: 1 } as never);
    expect(inkOf(marked)!.outset).toBeGreaterThan(inkOf(plain)!.outset);
  });

  // An open head stops the ribbon nowhere, but its arms still paint past the
  // line, and visible chrome is hittable.
  it.each(['arrow-open', 'bar'])('covers the painted extent of %s, which insets nothing', (key) => {
    const plain = nodeWith({ paint: { fill: 'solid', color: '#000' }, width: 2 });
    const marked = nodeWith({ paint: { fill: 'solid', color: '#000' }, width: 2, markerEnd: key });
    const inkOf = (n: unknown) =>
      findNodeShape(n as never)!.ink!(n as never, POSE as never, { scale: 1 } as never)!.outset;
    // arrow-open's arms reach 2.867 units back, bar's 1.5 across; both carry a
    // 1-unit outline, half of which lies outside the geometry.
    const reach = key === 'arrow-open' ? 2.867 + 0.5 : 1.5 + 0.5;
    expect(inkOf(marked)).toBeCloseTo(inkOf(plain) + reach * 2, 3);
  });

  // A { px } head is built on screen, so its reach is screen pixels at any
  // scale, beside the world reach of the world-width line it caps.
  it('reaches a { px } marker size in screen pixels', () => {
    const node = nodeWith({
      paint: { fill: 'solid', color: '#000' }, width: 2,
      markerEnd: { key: 'arrow', size: { px: 8 } },
    });
    const ink = (scale: number) => findNodeShape(node)!.ink!(node, POSE as never, { scale } as never)!;
    // A centered 2-wide stroke reaches 1; the arrow reaches 3 size units.
    for (const scale of [1, 4]) expect(ink(scale)).toMatchObject({ outset: 1, outsetPx: 24 });
  });
});

/** A derived node paints the path handed to it on the paint context rather
 *  than one on its own data — an edge in a diagram, whose geometry is computed
 *  from the two nodes it joins. */
function derivedNodeWith(stroke: unknown) {
  return {
    id: 'e1',
    data: { fill: null, stroke },
    dependsOn: ['a', 'b'],
    derivePath: () => LINE,
  } as never;
}

describe('markers on a derived path', () => {
  const STROKE = { paint: { fill: 'solid', color: '#000' }, width: 2 };
  const paint = (node: unknown) =>
    findNodeShape(node as never)!.paint!(node as never, POSE as never, { derivedPath: LINE } as never);

  it('is painted by the derived painter, not the path one', () => {
    expect(findNodeShape(derivedNodeWith(STROKE) as never)!.id).toBe('kit:derived');
  });

  it('emits only the stroke command when no marker is set', () => {
    expect(paint(derivedNodeWith(STROKE))).toHaveLength(1);
  });

  it('leaves the marker on the stroke for the renderer to draw', () => {
    const cmds = paint(derivedNodeWith({ ...STROKE, markerEnd: 'arrow' }));
    expect(cmds).toHaveLength(1);
    expect((cmds[0] as { stroke?: { markerEnd?: unknown } }).stroke?.markerEnd).toBe('arrow');
  });
});
