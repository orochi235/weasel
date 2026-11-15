import { afterEach, describe, expect, it } from 'vitest';
import { polygonFromPoints, type Path } from '@weasel-js/geom';
import {
  findNodeShape, findShapeBounds, findShapeSilhouette, registerNodeShape, shapeCoversPoint,
  _resetShapePaintersForTests, type NodeShapeEntry,
} from 'canvas/NodeShape';
import { solid, strokeOf } from '../../util/paint';
import type { Node } from 'core/scene/types';

const TRIANGLE: Path = polygonFromPoints([{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 50, y: 80 }]);

function node(data: Record<string, unknown> | null): Node<unknown, 'main', Path> {
  return { id: 'p', kind: 'mark', layer: 'main', pose: TRIANGLE, data, parent: null } as unknown as Node<unknown, 'main', Path>;
}

afterEach(() => { _resetShapePaintersForTests(); });

describe('kit:path-pose', () => {
  it('paints a Path pose in its data.fill and data.stroke', () => {
    const n = node({ fill: { paint: solid('#7fb069') }, stroke: strokeOf('#1a130d', 2) });
    const painter = findNodeShape(n)!;
    expect(painter.id).toBe('kit:path-pose');
    const [cmd] = painter.paint(n, TRIANGLE);
    expect(cmd).toMatchObject({ kind: 'path', path: TRIANGLE, fill: expect.anything(), stroke: expect.anything() });
  });

  it('outlines the pose, picks its inside, and bounds it with its stroke', () => {
    const n = node({ fill: { paint: solid('#7fb069') }, stroke: strokeOf('#000', 10) });
    expect(findShapeSilhouette(n, TRIANGLE)).not.toBeNull();
    expect(shapeCoversPoint(n, TRIANGLE, 50, 30)).toBe(true);
    expect(shapeCoversPoint(n, TRIANGLE, 5, 70)).toBe(false);
    const b = findShapeBounds(n, TRIANGLE, { scale: 1 })!;
    expect(b.x).toBeLessThan(0);
    expect(b.x + b.width).toBeGreaterThan(100);
  });

  it('paints nothing for a node with no data, and leaves groups alone', () => {
    expect(findNodeShape(node(null))!.paint(node(null), TRIANGLE)).toEqual([{ kind: 'path', path: TRIANGLE }]);
    expect(findNodeShape({ ...node({}), kind: 'group' } as never)).toBeUndefined();
  });

  it('yields to a consumer painter for path-posed nodes', () => {
    const mine: NodeShapeEntry = { id: 'app:mine', matches: () => true, paint: () => [] };
    registerNodeShape(mine);
    expect(findNodeShape(node({ fill: { paint: solid('#000') } }))?.id).toBe('app:mine');
  });
});
