import { describe, expect, it } from 'vitest';
import type { GraphNode } from '../graph';
import { axesFor } from '../layout';
import { turnOutward } from './inward';
import { PLACEHOLDER } from './types';

const node = (id: string, x: number, width: number, cluster?: string): GraphNode => ({ id, bounds: { x, y: 0, width, height: 30 }, pinned: false, ...(cluster !== undefined ? { cluster } : {}) });

describe('turnOutward', () => {
  const k = node('k', 0, 80, 'K');
  const u = node('u', 0, 80);
  const hop = node(`${PLACEHOLDER}e:1`, 120, 10);
  const turn = (minWidth?: number) =>
    turnOutward({
      graph: { clusters: [{ id: 'K', members: ['k'], inset: { top: 12, right: 12, bottom: 12, left: 12 }, ...(minWidth !== undefined ? { minWidth } : {}) }] },
      rows: [[k], [u, hop]],
      crossAt: new Map([[k.id, 0], [u.id, 0], [hop.id, 120]]),
      axes: axesFor('down'),
      pinned: new Set(),
      hops: [],
    });

  it('turns a node past placeholders reaching beyond every cluster box', () => {
    expect(turn()?.[1]!.map((n) => n.id)).toEqual([hop.id, 'u']);
  });

  it('leaves placeholders inside the box a cluster’s minWidth widens', () => {
    // K's box is 300 wide, centered on k: -110 to 190.
    expect(turn(300)).toBeUndefined();
  });
});
