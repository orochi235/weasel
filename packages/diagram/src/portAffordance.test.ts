import { describe, it, expect } from 'vitest';
import { viewToTransform, type ChromeState } from '@weasel-js/core';
import { createPortAffordance, portScratchOf } from './portAffordance';
import type { DiagramNodeLike } from './trait';

interface Rect { x: number; y: number; width: number; height: number; rotation?: number }

const node = (data: unknown, id: string): DiagramNodeLike => ({ id, kind: 'mark', data });

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

  it('leaves out the ports showsPort turns away', () => {
    const trait = { diagram: { ports: [{ id: 'in', type: 'image', at: { u: 0, v: 0.5 } }, { id: 'extra', at: { u: 1, v: 0.5 } }] } };
    const regions = createPortAffordance<Rect>(
      () => [{ node: node(trait, 'a'), pose: box }],
      { showsPort: (p) => p.type !== undefined },
    ).regions(state);
    expect(regions.map((r) => r.id)).toEqual(['a:in']);
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

describe('port paint', () => {
  const paintParticipants = () => [{
    node: node({ diagram: { ports: [
      { id: 'in', at: { u: 0, v: 0.5 }, type: 'image' },
      { id: 'amt', at: { u: 0, v: 0.8 }, type: 'number' },
    ] } }, 'a'),
    pose: box,
  }];

  it('asks the fill function once per port and paints what it answers', () => {
    const fill = (port: { type?: string }) => ({ paint: { color: port.type === 'image' ? '#00f' : '#fa0' } });
    const regions = createPortAffordance<Rect>(paintParticipants, { fill }).regions(state);
    expect(regions.map((r) => r.paint)).toEqual([
      { kind: 'square', sizePx: 7, fill: { paint: { color: '#00f' } } },
      { kind: 'square', sizePx: 7, fill: { paint: { color: '#fa0' } } },
    ]);
  });

  it('paints a circle as one path centered on the port in screen pixels', () => {
    const [region] = createPortAffordance<Rect>(paintParticipants, { shape: 'circle', sizePx: 8 }).regions(state);
    const paint = region!.paint!;
    expect(paint.kind).toBe('custom');
    if (paint.kind !== 'custom') return;
    const cmds = paint.draw({
      world: { x: 10, y: 20 },
      local: region!.shape,
      view: { x: 5, y: 7, scale: { x: 2, y: 2 } },
      state,
    });
    expect(cmds).toHaveLength(1);
    const path = (cmds[0] as { path: { coords: Float32Array } }).path;
    const xs = [...path.coords].filter((_, i) => i % 2 === 0);
    const ys = [...path.coords].filter((_, i) => i % 2 === 1);
    // Screen center is pan + world * zoom; read both from `viewToTransform` so the
    // test does not restate the view's own convention.
    const mid = (v: number[]) => (Math.min(...v) + Math.max(...v)) / 2;
    expect(Math.max(...xs) - Math.min(...xs)).toBeCloseTo(8, 4);
    expect(Math.max(...ys) - Math.min(...ys)).toBeCloseTo(8, 4);
    const t = viewToTransform({ x: 5, y: 7, scale: { x: 2, y: 2 } });
    expect(mid(xs)).toBeCloseTo(t.panX + 10 * t.zoom.x, 4);
    expect(mid(ys)).toBeCloseTo(t.panY + 20 * t.zoom.y, 4);
  });
});
