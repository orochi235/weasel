import { describe, it, expect } from 'vitest';
import { RECT_POSE_DESCRIPTOR, type PoseDescriptor } from '@weasel-js/core';
import { COMPASS, DEFAULT_PORTS, portOf, portsOf } from './ports';
import { createDiagramNodes } from './trait';
import type { DiagramNodeLike } from './trait';

interface Rect { x: number; y: number; width: number; height: number; rotation?: number }

const node = (data: unknown, id = 'n1'): DiagramNodeLike => ({ id, kind: 'leaf', data });

/** 100 wide, 40 tall, at the origin. */
const POSE: Rect = { x: 0, y: 0, width: 100, height: 40 };

/** Rounded so a rotation's floating-point dust doesn't dominate a comparison.
 *  `|| 0` collapses the `-0` a rotation through pi/2 leaves behind. */
const round = (v: number): number => Math.round(v * 1e6) / 1e6 || 0;
const at = (p: { x: number; y: number }) => ({ x: round(p.x), y: round(p.y) });

describe('portsOf', () => {
  it('gives a node that says nothing at all no ports', () => {
    expect(portsOf(node({}), POSE)).toEqual([]);
  });

  it('gives a bare participant the four edge midpoints of its bounds', () => {
    const ports = portsOf(node({ diagram: {} }), POSE);
    expect(ports.map((p) => p.id)).toEqual(['n', 'e', 's', 'w']);
    expect(ports.map((p) => p.point)).toEqual([
      { x: 50, y: 0 },
      { x: 100, y: 20 },
      { x: 50, y: 40 },
      { x: 0, y: 20 },
    ]);
  });

  it('points each default port away from the node', () => {
    const ports = portsOf(node({ diagram: {} }), POSE);
    expect(ports.map((p) => p.normal)).toEqual([
      { x: 0, y: -1 },
      { x: 1, y: 0 },
      { x: 0, y: 1 },
      { x: -1, y: 0 },
    ]);
  });

  it('names the node each port belongs to', () => {
    expect(portsOf(node({ diagram: {} }, 'step-3'), POSE)[0]!.nodeId).toBe('step-3');
  });

  it('places a declared anchor at its fraction of the bounds', () => {
    const ports = portsOf(node({ diagram: { ports: [{ id: 'in', at: { u: 0.25, v: 1 } }] } }), POSE);
    expect(ports[0]!.point).toEqual({ x: 25, y: 40 });
  });

  it('offsets by the bounds origin rather than assuming the origin', () => {
    const ports = portsOf(node({ diagram: {} }), { x: 200, y: 300, width: 100, height: 40 });
    expect(ports[0]!.point).toEqual({ x: 250, y: 300 });
  });

  it('gives a corner anchor the diagonal, whatever the aspect ratio', () => {
    const ports = portsOf(node({ diagram: { ports: [{ id: 'c', at: COMPASS.se }] } }), POSE);
    const half = Math.SQRT1_2;
    expect(at(ports[0]!.normal!)).toEqual({ x: round(half), y: round(half) });
  });

  it('gives a port at the dead center no direction', () => {
    const ports = portsOf(node({ diagram: { ports: [{ id: 'mid', at: { u: 0.5, v: 0.5 } }] } }), POSE);
    expect(ports[0]!.normal).toBeNull();
  });

  it('honors an explicit normal over the one the anchor implies', () => {
    const ports = portsOf(
      node({ diagram: { ports: [{ id: 'up', at: COMPASS.s, normal: { x: 0, y: -1 } }] } }),
      POSE,
    );
    expect(ports[0]!.normal).toEqual({ x: 0, y: -1 });
  });

  it('carries a port type through untouched', () => {
    const ports = portsOf(node({ diagram: { ports: [{ id: 'in', at: COMPASS.w, type: 'data' }] } }), POSE);
    expect(ports[0]!.type).toBe('data');
  });

  it('leaves the type key off a port that declared none', () => {
    expect('type' in portsOf(node({ diagram: {} }), POSE)[0]!).toBe(false);
  });
});

describe('portsOf — rotation', () => {
  /** A quarter turn about the center of a 100x40 box at the origin. */
  const TURNED: Rect = { ...POSE, rotation: Math.PI / 2 };

  it('carries a port around with the node', () => {
    const ports = portsOf(node({ diagram: {} }), TURNED);
    // 'n' sits at (50, 0); a quarter turn about (50, 20) puts it at (70, 20).
    expect(at(ports[0]!.point)).toEqual({ x: 70, y: 20 });
  });

  it('turns the normal about the origin, not about the node', () => {
    const ports = portsOf(node({ diagram: {} }), TURNED);
    expect(at(ports[0]!.normal!)).toEqual({ x: 1, y: 0 });
  });

  it('leaves a null normal null', () => {
    const ports = portsOf(node({ diagram: { ports: [{ id: 'mid', at: { u: 0.5, v: 0.5 } }] } }), TURNED);
    expect(ports[0]!.normal).toBeNull();
  });
});

describe('portsOf — the geometry seam', () => {
  it('reads bounds through the descriptor it is given', () => {
    const ports = portsOf(node({ diagram: {} }), POSE, {
      geometry: RECT_POSE_DESCRIPTOR as PoseDescriptor<Rect>,
    });
    expect(ports[0]!.point).toEqual({ x: 50, y: 0 });
  });

  it('takes a descriptor that reports no rotation at face value', () => {
    const turned: Rect = { ...POSE, rotation: Math.PI / 2 };
    const ports = portsOf(node({ diagram: {} }), turned, {
      geometry: RECT_POSE_DESCRIPTOR as PoseDescriptor<Rect>,
    });
    expect(ports[0]!.point).toEqual({ x: 50, y: 0 });
  });
});

describe('portsOf — the reader seam', () => {
  const byKind = createDiagramNodes([
    { name: 'step', matches: (d) => (d as { kind?: string })?.kind === 'step', trait: {} },
    {
      name: 'stage',
      matches: (d) => (d as { kind?: string })?.kind === 'stage',
      trait: () => ({ ports: [{ id: 'out', at: COMPASS.e }] }),
    },
  ]);

  it('gives every node of a declared kind the trait, unstamped', () => {
    const ports = portsOf(node({ kind: 'step' }), POSE, { read: byKind });
    expect(ports.map((p) => p.id)).toEqual(['n', 'e', 's', 'w']);
  });

  it('calls a per-node trait with the node data', () => {
    const ports = portsOf(node({ kind: 'stage' }), POSE, { read: byKind });
    expect(ports.map((p) => p.id)).toEqual(['out']);
  });

  it("lets one node's own trait override what its kind says", () => {
    const ports = portsOf(node({ kind: 'step', diagram: { ports: [] } }), POSE, { read: byKind });
    expect(ports).toEqual([]);
  });

  it('leaves a node of no declared kind out of the diagram', () => {
    expect(portsOf(node({ kind: 'note' }), POSE, { read: byKind })).toEqual([]);
  });

  it('refuses two entries under one name', () => {
    expect(() => createDiagramNodes([
      { name: 'step', matches: () => true, trait: {} },
      { name: 'step', matches: () => true, trait: {} },
    ])).toThrow(/duplicate entry name/);
  });
});

describe('portOf', () => {
  it('finds one port by id', () => {
    expect(portOf(node({ diagram: {} }), POSE, 'e')!.point).toEqual({ x: 100, y: 20 });
  });

  it('answers undefined for a port the node does not have', () => {
    expect(portOf(node({ diagram: {} }), POSE, 'nope')).toBeUndefined();
  });
});

describe('DEFAULT_PORTS', () => {
  it('is frozen — it is shared by every node that declares nothing', () => {
    expect(Object.isFrozen(DEFAULT_PORTS)).toBe(true);
  });
});
