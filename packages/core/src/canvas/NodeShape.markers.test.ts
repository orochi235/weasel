import { describe, it, expect } from 'vitest';
import { findNodeShape } from './NodeShape';
import { PATH_M, PATH_L, type PolygonPath } from '../core/geometry/path';

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

  it('appends a command for the marker', () => {
    const node = nodeWith({ paint: { fill: 'solid', color: '#000' }, width: 2, markerEnd: 'arrow' });
    const cmds = findNodeShape(node)!.paint!(node, POSE as never, {} as never);
    expect(cmds).toHaveLength(2);
  });

  it('draws the marker after the stroke, so it sits on top', () => {
    const node = nodeWith({
      paint: { fill: 'solid', color: '#000' }, width: 2,
      markerStart: 'arrow', markerEnd: 'arrow',
    });
    const cmds = findNodeShape(node)!.paint!(node, POSE as never, {} as never);
    expect(cmds).toHaveLength(3);
    expect((cmds[0] as { stroke?: unknown }).stroke).toBeDefined();
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

  // The hit-test already reserves room for a marker on a derived node, so a
  // dropped one is a stroke the pointer can reach past and nothing to see.
  it('appends a command for the marker', () => {
    expect(paint(derivedNodeWith({ ...STROKE, markerEnd: 'arrow' }))).toHaveLength(2);
  });

  it('draws the marker after the stroke, so it sits on top', () => {
    const cmds = paint(derivedNodeWith({ ...STROKE, markerStart: 'arrow', markerEnd: 'arrow' }));
    expect(cmds).toHaveLength(3);
    expect((cmds[0] as { stroke?: unknown }).stroke).toBeDefined();
  });
});
