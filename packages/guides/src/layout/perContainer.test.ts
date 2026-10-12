import { describe, expect, it, vi } from 'vitest';
import type { LayoutStrategy } from '@weasel-js/core';
import { perContainer } from './perContainer';
import { nearest } from './snaps';
import { freeform } from './strategies/freeform';

type P = { x: number; y: number };

const box = (id: string) => ({ id, bounds: { x: 0, y: 0, width: 100, height: 100 } });
const dragged = { id: 'd', originPose: { x: 0, y: 0 }, pose: { x: 5, y: 5 }, sourceContainerId: null };

/** A strategy that remembers how often it arranged, which a pure one cannot. */
function counting(): LayoutStrategy<P> & { runs: number } {
  const base = freeform<P>();
  const self = {
    ...base,
    runs: 0,
    childPoses(container: Parameters<typeof base.childPoses>[0], children: Parameters<typeof base.childPoses>[1]) {
      self.runs++;
      return new Map(children.map((c) => [c.id, { x: self.runs, y: 0 }]));
    },
  };
  return self;
}

describe('perContainer', () => {
  it('builds one strategy per container and keeps its state apart', () => {
    const factory = vi.fn((_container: { id: string }) => counting());
    const layout = perContainer<P>(factory, { snap: nearest() });
    const kids = [{ id: 'k', pose: { x: 0, y: 0 } }];
    layout.childPoses(box('A'), kids);
    layout.childPoses(box('A'), kids);
    expect(layout.childPoses(box('A'), kids).get('k')).toEqual({ x: 3, y: 0 });
    expect(layout.childPoses(box('B'), kids).get('k')).toEqual({ x: 1, y: 0 });
    expect(factory).toHaveBeenCalledTimes(2);
    expect(factory.mock.calls.map(([c]) => c.id)).toEqual(['A', 'B']);
  });

  it('starts a container over once it is forgotten', () => {
    const layout = perContainer<P>(() => counting(), { snap: nearest() });
    const kids = [{ id: 'k', pose: { x: 0, y: 0 } }];
    layout.childPoses(box('A'), kids);
    layout.forget('A');
    expect(layout.childPoses(box('A'), kids).get('k')).toEqual({ x: 1, y: 0 });
  });

  it('drops the container used longest ago past max', () => {
    const factory = vi.fn(() => counting());
    const layout = perContainer<P>(factory, { snap: nearest(), max: 2 });
    layout.childPoses(box('A'), []);
    layout.childPoses(box('B'), []);
    layout.childPoses(box('A'), []);
    layout.childPoses(box('C'), []);
    layout.childPoses(box('A'), []);
    expect(factory).toHaveBeenCalledTimes(3);
    layout.childPoses(box('B'), []);
    expect(factory).toHaveBeenCalledTimes(4);
  });

  it('answers for a method the built strategy leaves out the way its absence would', () => {
    const layout = perContainer<P>(() => counting(), { snap: nearest() });
    const kids = [{ id: 'k', pose: { x: 0, y: 0 } }];
    expect(layout.arrive!(box('A'), kids, new Set(['k']))).toEqual({ poses: new Map([['k', { x: 1, y: 0 }]]) });
    expect(layout.depart!(box('A'), kids, new Set(['gone'])).poses.get('k')).toEqual({ x: 2, y: 0 });
    expect(layout.acceptsDrop!(box('A'), dragged)).toBe(true);
    expect(layout.dropRegion!(box('A'))).toBeNull();
    expect(layout.contentExtent!(box('A'), kids)).toEqual(box('A').bounds);
    expect(layout.releaseDrop!(box('A'), kids, dragged)).toBeNull();
  });

  it('passes the optional methods a built strategy has through to it', () => {
    const layout = perContainer<P>(
      (container) => ({ ...freeform<P>(), acceptsDrop: () => container.id === 'open', arrive: () => null }),
      { snap: nearest() },
    );
    expect(layout.acceptsDrop!(box('open'), dragged)).toBe(true);
    expect(layout.acceptsDrop!(box('shut'), dragged)).toBe(false);
    expect(layout.arrive!(box('open'), [], new Set())).toBeNull();
  });
});
