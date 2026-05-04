import { describe, it, expect } from 'vitest';
import { freeform } from './freeform';
import { nearestWithin } from '../snaps';

type P = { x: number; y: number; width: number; height: number };

const container = { id: 'C', bounds: { x: 0, y: 0, width: 100, height: 100 } };
const child = (id: string, x: number, y: number): { id: string; pose: P } => ({
  id,
  pose: { x, y, width: 10, height: 10 },
});

describe('freeform', () => {
  it('getChildPositions returns identity over stored poses', () => {
    const layout = freeform<P>();
    const children = [child('a', 5, 5), child('b', 30, 40)];
    const got = layout.getChildPositions(container, children);
    expect(got.get('a')).toEqual({ x: 5, y: 5, width: 10, height: 10 });
    expect(got.get('b')).toEqual({ x: 30, y: 40, width: 10, height: 10 });
    expect(got.size).toBe(2);
  });

  it('getDropTargets returns empty array (snap is none by default)', () => {
    const layout = freeform<P>();
    const targets = layout.getDropTargets(
      container,
      [child('a', 5, 5)],
      {
        id: 'd',
        originPose: { x: 0, y: 0, width: 10, height: 10 },
        pose: { x: 0, y: 0, width: 10, height: 10 },
        sourceContainerId: null,
      },
    );
    expect(targets).toEqual([]);
  });

  it('reflowFor returns an empty map (no sibling movement)', () => {
    const layout = freeform<P>();
    const reflow = layout.reflowFor(
      container,
      [child('a', 5, 5)],
      {
        id: 'd',
        originPose: { x: 0, y: 0, width: 10, height: 10 },
        pose: { x: 0, y: 0, width: 10, height: 10 },
        sourceContainerId: null,
      },
      null,
    );
    expect(reflow.size).toBe(0);
  });

  it('commitDrop emits a single transform op for the dragged child', () => {
    const layout = freeform<P>();
    const ops = layout.commitDrop(
      container,
      [],
      {
        id: 'd',
        originPose: { x: 0, y: 0, width: 10, height: 10 },
        pose: { x: 12, y: 34, width: 10, height: 10 },
        sourceContainerId: null,
      },
      null,
    );
    expect(ops).toHaveLength(1);
    expect(ops[0].label).toBe('Drop');
    expect(typeof ops[0].apply).toBe('function');
    expect(typeof ops[0].invert).toBe('function');
  });

  it('accepts a snap override', () => {
    const layout = freeform<P>({ snap: nearestWithin({ tolerance: 1 }) });
    expect(layout.snap.pickTarget([], { x: 0, y: 0 })).toBeNull();
  });
});
