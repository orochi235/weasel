import { describe, it, expect } from 'vitest';
import { createEdgeEnds } from './edgeEndLayer';
import type { GraphNodeLike } from './graph';
import type { LayoutFrame } from './layoutFrame';

interface Rect { x: number; y: number; width: number; height: number }

const shape = (id: string, x: number) => ({
  node: { id, kind: 'mark', data: { diagram: {} } } as GraphNodeLike,
  pose: { x, y: 0, width: 100, height: 40 } as Rect,
});

const PARTICIPANTS = () => [
  shape('A', 0),
  shape('B', 300),
  {
    node: {
      id: 'ab', kind: 'mark', dependsOn: ['A', 'B'],
      data: { diagram: { from: { port: 'e' }, to: { port: 'w' }, router: 'straight' } },
    } as GraphNodeLike,
    pose: { x: 0, y: 0, width: 0, height: 0 } as Rect,
  },
];

/** A plane that sits 1000 to the right of the pose's own space. */
const SHIFTED: LayoutFrame<Rect> = {
  box: (p) => ({ x: p.x + 1000, y: p.y, width: p.width, height: p.height }),
  translate: (p, dx, dy) => ({ ...p, x: p.x + dx, y: p.y + dy }),
  fromBox: (b, p) => ({ ...p, x: b.x - 1000, y: b.y, width: b.width, height: b.height }),
};

describe('createEdgeEnds', () => {
  it('resolves the ends on the plane its frame names', () => {
    const ends = createEdgeEnds<Rect>(PARTICIPANTS, { frame: SHIFTED })('ab')!;
    expect(ends.points.from).toEqual({ x: 1100, y: 20 });
    expect(ends.points.to).toEqual({ x: 1300, y: 20 });
  });
});
