import { describe, it, expect } from 'vitest';
import type { ChromeState } from '@weasel-js/core';
import { createPortAffordance, portScratchOf } from './portAffordance';
import type { DiagramNodeLike } from './trait';

interface Rect { x: number; y: number; width: number; height: number; rotation?: number }

const node = (data: unknown, id: string): DiagramNodeLike => ({ id, kind: 'leaf', data });

const box: Rect = { x: 0, y: 0, width: 100, height: 40 };

/** Nothing selected, no bounds resolvable — the port affordance reads its
 *  participants from its own source, not from chrome state. */
const state: ChromeState = {
  selection: [],
  multiActive: false,
  boundsOf: () => null,
  unionBounds: null,
  modifiers: { alt: false, shift: false, meta: false, ctrl: false },
};

describe('createPortAffordance', () => {
  it('declares one region per port of every participant', () => {
    const affordance = createPortAffordance<Rect>(() => [
      { node: node({ diagram: {} }, 'a'), pose: box },
    ]);
    expect(affordance.regions(state).map((r) => r.id)).toEqual(['a:n', 'a:e', 'a:s', 'a:w']);
  });

  it('puts a region where the port is, not where its anchor is', () => {
    // A parallelogram's west anchor floats in the gap beside the leaning edge.
    // `portsOf` casts it onto the outline; the region has to be on the ink or
    // the visible port and the grabbable one are different places.
    const trait = { diagram: { outline: 'parallelogram', ports: [{ id: 'w', at: { u: 0, v: 0.5 } }] } };
    const [region] = createPortAffordance<Rect>(() => [
      { node: node(trait, 'p'), pose: box },
    ]).regions(state);
    // Lean is a fifth of the width, so the left edge runs (20,0)→(0,40) and
    // crosses the anchor's own row at x = 10.
    expect(region!.shape).toMatchObject({ kind: 'point', x: 10, y: 20 });
  });

  it('rotates a port once, not twice', () => {
    // `portsOf` already carries the port through the pose's rotation, so the
    // region must name no target — the framework rotates anything that does.
    const rotated: Rect = { ...box, rotation: Math.PI / 2 };
    const regions = createPortAffordance<Rect>(() => [
      { node: node({ diagram: {} }, 'a'), pose: rotated },
    ]).regions(state);
    expect(regions.every((r) => r.targetId === null)).toBe(true);
    const east = regions.find((r) => r.id === 'a:e')!.shape as { x: number; y: number };
    // East midpoint (100, 20) about the center (50, 20) through a quarter turn.
    expect({ x: Math.round(east.x), y: Math.round(east.y) }).toEqual({ x: 50, y: 70 });
  });

  it('gives an edge no ports', () => {
    const edge = node({ diagram: { from: {}, to: {}, router: 'straight' } }, 'e1');
    expect(createPortAffordance<Rect>(() => [{ node: edge, pose: box }]).regions(state)).toEqual([]);
  });

  it('claims a pointer press so a port drag is never a node move', () => {
    const [region] = createPortAffordance<Rect>(() => [
      { node: node({ diagram: {} }, 'a'), pose: box },
    ]).regions(state);
    expect(region!.strength).toBe('exclusive');
    expect(region!.claimedKinds).toEqual(['pointer']);
  });

  it('hands the drag the port it started on', () => {
    const [region] = createPortAffordance<Rect>(() => [
      { node: node({ diagram: {} }, 'a'), pose: box },
    ]).regions(state);
    expect(portScratchOf({ payload: region!.bind().initialScratch })).toMatchObject({
      targetId: 'a', nodeId: 'a', portId: 'n',
    });
  });

  it('shows ports only for the participants `shows` accepts', () => {
    const regions = createPortAffordance<Rect>(
      () => [
        { node: node({ diagram: {} }, 'a'), pose: box },
        { node: node({ diagram: {} }, 'b'), pose: box },
      ],
      { shows: (n) => n.id === 'b' },
    ).regions(state);
    expect([...new Set(regions.map((r) => r.id.split(':')[0]))]).toEqual(['b']);
  });
});
