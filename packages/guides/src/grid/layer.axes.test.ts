import { describe, expect, it } from 'vitest';
import { createScene, type Bounds, type DrawCommand, type GroupDrawCommand, type NodeId, type PathDrawCommand } from '@weasel-js/core';
import { createGridLayer } from './layer';
import { sceneGridRegions } from './regions';

const VIEW = { x: 0, y: 0, scale: { x: 1, y: 1 } };
const DIMS = { width: 100, height: 100, dpr: 1 };
const BOUNDS = () => ({ x: 0, y: 0, width: 100, height: 100 });

const segments = (tree: readonly DrawCommand[]): number[][] => tree.flatMap((c) =>
  c.kind === 'group' ? segments((c as GroupDrawCommand).children) : [Array.from((c as PathDrawCommand).path.kind === 'polygon'
    ? ((c as PathDrawCommand).path as { coords: Float32Array }).coords : [])]);
const verticals = (tree: readonly DrawCommand[]) => segments(tree).filter((c) => c[0] === c[2]);
const horizontals = (tree: readonly DrawCommand[]) => segments(tree).filter((c) => c[1] === c[3]);

describe('createGridLayer — a rule per axis', () => {
  it('draws no lines on an axis left out', () => {
    const tree = createGridLayer({ spacing: { y: 25 }, bounds: BOUNDS }).draw(undefined, VIEW, DIMS);
    expect(verticals(tree)).toEqual([]);
    expect(horizontals(tree).map((c) => c[1])).toEqual([0, 25, 50, 75, 100]);
  });

  it('draws explicit lines where they are', () => {
    const tree = createGridLayer({ spacing: { x: { at: [10, 40, 55] }, y: 50 }, bounds: BOUNDS }).draw(undefined, VIEW, DIMS);
    expect(verticals(tree).map((c) => c[0])).toEqual([10, 40, 55]);
  });

  it('limits a pitch to its range, and the lines across it to that range', () => {
    const tree = createGridLayer({ spacing: { x: { pitch: 10, offset: 5, from: 25, to: 45 }, y: 50 }, bounds: BOUNDS })
      .draw(undefined, VIEW, DIMS);
    expect(verticals(tree).map((c) => c[0])).toEqual([25, 35, 45]);
    expect(verticals(tree).every((c) => c[1] === 0 && c[3] === 100)).toBe(true);
    expect(horizontals(tree).map((c) => [c[0], c[2]])).toEqual([[25, 45], [25, 45], [25, 45]]);
  });

  it('accents only an axis with a pitch', () => {
    const accent = { paint: { kind: 'solid' as const, color: 'red' }, width: 1 };
    const tree = createGridLayer({
      spacing: { x: { at: [10, 40] }, y: 10 }, accentEvery: 5, bounds: BOUNDS, style: { accent },
    }).draw(undefined, VIEW, DIMS) as PathDrawCommand[];
    const red = tree.filter((c) => c.stroke === undefined ? false : (c.stroke.paint as { color?: string }).color === 'red');
    expect(red.every((c) => c.path.kind === 'polygon' && c.path.coords[1] === c.path.coords[3])).toBe(true);
    expect(red.map((c) => (c.path as { coords: Float32Array }).coords[1])).toEqual([0, 50, 100]);
  });
});

describe('createGridLayer — containers with grids of their own', () => {
  function scene() {
    const s = createScene<object, 'default', Bounds>({ systemLayers: [{ id: 'default', visible: true, locked: false }] });
    const holes = s.add({ kind: 'group', layer: 'default', pose: { x: 10, y: 10, width: 30, height: 30 }, data: {} }) as string;
    const blank = s.add({ kind: 'group', layer: 'default', pose: { x: 60, y: 10, width: 30, height: 30 }, data: {} }) as string;
    s.add({ kind: 'group', layer: 'default', pose: { x: 60, y: 60, width: 30, height: 30 }, data: {} });
    const gridOf = (id: NodeId) => (id === holes ? { x: 15 } : id === blank ? null : undefined);
    return { regions: sceneGridRegions(s, { gridOf }), holes, blank };
  }

  it('records each container that has a grid of its own, or none', () => {
    const { regions } = scene();
    expect(regions.map((r) => r.spacing)).toEqual([{ x: 15 }, null]);
    expect(regions[0]!.chain).toBeUndefined();
  });

  it('draws a container\'s own grid in its frame, and none in a container whose grid is null', () => {
    const { regions } = scene();
    const [root, holes, ...rest] = createGridLayer({ spacing: 20, regions: () => regions, bounds: BOUNDS }).draw(undefined, VIEW, DIMS);
    expect((root as GroupDrawCommand).clip).toBeDefined();
    // Drawn in the container's frame, from its corner: lines at 0, 15 and 30 of it, x only.
    expect(verticals([holes!]).map((c) => c[0])).toEqual([0, 15, 30]);
    expect(horizontals([holes!])).toEqual([]);
    expect(rest).toEqual([]);
  });
});
