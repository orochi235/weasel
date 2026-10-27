import { describe, expect, it } from 'vitest';
import {
  createScene,
  RIGID_POSE_COMPOSITION,
  type Bounds,
  type DrawCommand,
  type GroupDrawCommand,
  type PathDrawCommand,
  type UnitScope,
} from '@weasel-js/core';
import { applyToPoint, mat3, multiply, PATH_Z, rotateAboutPoint, scale, translate, type Affine } from '@weasel-js/geom';
import { createCellHighlightLayer } from './cellHighlight';
import { createGridLayer } from './layer';
import { pointToGridCell } from './pointToGridCell';
import { sceneGridRegions, type GridRegion } from './regions';

const ROOT: UnitScope = { system: { base: 'u', units: { u: 1 } } };
/** Ten of its units are five of the root's. */
const HALF: UnitScope = { system: { base: 'h', units: { h: 1 } }, scale: 0.5 };
/** Ten of its units are one of the scope around it. */
const TENTH: UnitScope = { system: { base: 't', units: { t: 1 } }, scale: 0.1 };

const VIEW = { x: 0, y: 0, scale: { x: 1, y: 1 } };
const DIMS = { width: 100, height: 100, dpr: 1 };

const square = (x: number, y: number, size: number) => [
  { x, y }, { x: x + size, y }, { x: x + size, y: y + size }, { x, y: y + size },
];

/** The x of every vertical line a group draws. */
const verticals = (g: DrawCommand): number[] =>
  (g as GroupDrawCommand).children
    .filter((c): c is PathDrawCommand => c.kind === 'path')
    .filter((c) => c.path.kind === 'polygon' && c.path.coords[0] === c.path.coords[2])
    .map((c) => (c.path as { coords: Float32Array }).coords[0]!);

/** How many closed contours a group's clip has. */
const contours = (g: DrawCommand): number =>
  Array.from(((g as GroupDrawCommand).clip as { commands: Uint8Array }).commands).filter((c) => c === PATH_Z).length;

describe('createGridLayer — unit scopes', () => {
  const region: GridRegion = { outline: square(20, 20, 40), chain: [ROOT, HALF] };

  it('draws a region on its own scope\'s pitch, and cuts it out of the root lattice', () => {
    const layer = createGridLayer({
      spacing: 10,
      scopes: { root: ROOT },
      regions: () => [region],
      bounds: () => ({ x: 0, y: 0, width: 100, height: 100 }),
    });
    const [root, inner] = layer.draw(undefined, VIEW, DIMS);
    expect(verticals(root!)).toEqual([0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100]);
    expect((root as GroupDrawCommand).clip).toMatchObject({ kind: 'polygon', fillRule: 'evenodd' });
    expect(contours(root!)).toBe(2);
    expect(verticals(inner!)).toEqual([20, 25, 30, 35, 40, 45, 50, 55, 60]);
    expect(contours(inner!)).toBe(1);
  });

  it('cuts a nested region out of the one around it', () => {
    const nested: GridRegion = { ...region, regions: [{ outline: square(30, 30, 10), chain: [ROOT, HALF, TENTH] }] };
    const layer = createGridLayer({
      spacing: 10,
      scopes: { root: ROOT },
      regions: () => [nested],
      bounds: () => ({ x: 0, y: 0, width: 100, height: 100 }),
    });
    const far = layer.draw(undefined, VIEW, DIMS);
    expect(contours(far[0]!)).toBe(2);
    expect(contours(far[1]!)).toBe(2);
    // Its 0.5-unit lines sit under the 4 px floor at this zoom, so the nested
    // region draws nothing; at 8x they show.
    expect(far).toHaveLength(2);
    const near = layer.draw(undefined, { x: 0, y: 0, scale: { x: 8, y: 8 } }, DIMS);
    expect(verticals(near[2]!)).toEqual(Array.from({ length: 21 }, (_, k) => 30 + k / 2));
  });

  it('runs a region\'s lattice through the bounds\' corner, as snapping does', () => {
    const layer = createGridLayer({
      spacing: 10,
      scopes: { root: ROOT },
      regions: () => [{ outline: square(21, 21, 20), chain: [ROOT, HALF] }],
      bounds: () => ({ x: 3, y: 3, width: 90, height: 90 }),
    });
    const [, inner] = layer.draw(undefined, VIEW, DIMS);
    expect(verticals(inner!)).toEqual([18, 23, 28, 33, 38, 43]);
  });

  it('draws one flat lattice with no regions, as it always has', () => {
    const layer = createGridLayer({
      spacing: 10,
      scopes: { root: ROOT },
      regions: () => [],
      bounds: () => ({ x: 0, y: 0, width: 30, height: 30 }),
    });
    expect(layer.draw(undefined, VIEW, DIMS).every((c) => c.kind === 'path')).toBe(true);
  });
});

describe('sceneGridRegions', () => {
  it('nests the scoped containers of a scene, each with its chain', () => {
    const scene = createScene<object, 'default', Bounds>({ systemLayers: [{ id: 'default', visible: true, locked: false }] });
    const pose = { x: 0, y: 0, width: 10, height: 10 };
    const outer = scene.add({ kind: 'group', layer: 'default', pose, data: {}, units: HALF });
    const plain = scene.add({ kind: 'group', layer: 'default', parent: outer, pose, data: {} });
    const inner = scene.add({ kind: 'group', layer: 'default', parent: plain, pose, data: {}, units: TENTH });
    scene.add({ kind: 'group', layer: 'default', pose, data: {} });

    const regions = sceneGridRegions(scene, ROOT, (id) => square(id === inner ? 1 : 0, 0, 1));
    expect(regions).toHaveLength(1);
    expect(regions[0]!.chain).toEqual([ROOT, HALF]);
    expect(regions[0]!.regions).toHaveLength(1);
    expect(regions[0]!.regions![0]).toMatchObject({ chain: [ROOT, HALF, TENTH], outline: square(1, 0, 1) });
  });

  it('leaves out a container with no outline, and everything inside it', () => {
    const scene = createScene<object, 'default', Bounds>({ systemLayers: [{ id: 'default', visible: true, locked: false }] });
    const pose = { x: 0, y: 0, width: 10, height: 10 };
    const outer = scene.add({ kind: 'group', layer: 'default', pose, data: {}, units: HALF });
    scene.add({ kind: 'group', layer: 'default', parent: outer, pose, data: {}, units: TENTH });
    expect(sceneGridRegions(scene, ROOT, () => null)).toEqual([]);
  });
});

describe('a hovered cell in a scoped grid', () => {
  const regions: GridRegion[] = [{ outline: square(20, 20, 40), chain: [ROOT, HALF] }];

  it('is on the lattice of the region under it, and names its pitch', () => {
    expect(pointToGridCell({ x: 31, y: 26 }, 10, undefined, undefined, { scopes: { root: ROOT }, regions }))
      .toEqual({ col: 6, row: 5, pitch: { x: 5, y: 5 } });
    expect(pointToGridCell({ x: 71, y: 26 }, 10, undefined, undefined, { scopes: { root: ROOT }, regions }))
      .toEqual({ col: 7, row: 2, pitch: { x: 10, y: 10 } });
  });

  it('is highlighted at its own lattice\'s size', () => {
    const layer = createCellHighlightLayer({ spacing: 10, getCell: () => ({ col: 6, row: 5, pitch: { x: 5, y: 5 } }) });
    expect(layer.draw(undefined, VIEW, DIMS)[0]).toMatchObject({ path: { kind: 'rect', x: 30, y: 25, width: 5, height: 5 } });
  });
});

/** `square`, in a frame's own coordinates, carried to world. */
const squareIn = (frame: Affine, x: number, y: number, size: number) =>
  square(x, y, size).map((p) => {
    const [wx, wy] = applyToPoint(frame, p.x, p.y);
    return { x: wx, y: wy };
  });

const TURN = Math.PI / 6;

describe('createGridLayer — a region\'s own frame', () => {
  it('draws a region\'s lattice in its frame, from its origin', () => {
    const frame = translate(23, 21);
    const layer = createGridLayer({
      spacing: 10,
      scopes: { root: ROOT },
      regions: () => [{ outline: squareIn(frame, 0, 0, 40), chain: [ROOT, HALF], frame }],
      bounds: () => ({ x: 0, y: 0, width: 100, height: 100 }),
    });
    const [, inner] = layer.draw(undefined, VIEW, DIMS);
    const turned = (inner as GroupDrawCommand).children[0] as GroupDrawCommand;
    expect(turned.transform).toEqual(mat3.fromAffine(frame));
    expect(verticals(turned)).toEqual([0, 5, 10, 15, 20, 25, 30, 35, 40]);
  });

  it('turns the lattice with a turned region, and keeps its lines a pixel wide', () => {
    const frame = multiply(rotateAboutPoint(40, 40, TURN), translate(20, 20));
    const layer = createGridLayer({
      spacing: 10,
      scopes: { root: ROOT },
      regions: () => [{ outline: squareIn(frame, 0, 0, 40), chain: [ROOT, HALF], frame }],
      bounds: () => ({ x: 0, y: 0, width: 100, height: 100 }),
    });
    const [, inner] = layer.draw(undefined, { x: 0, y: 0, scale: { x: 2, y: 2 } }, DIMS);
    const turned = (inner as GroupDrawCommand).children[0] as GroupDrawCommand;
    expect(turned.transform).toEqual(mat3.fromAffine(frame));
    expect(verticals(turned)).toEqual([0, 5, 10, 15, 20, 25, 30, 35, 40]);
    const line = turned.children[0] as PathDrawCommand;
    expect(line.stroke!.width).toBeCloseTo(0.5, 9);
  });

  it('measures a pixel in a stretched frame\'s own units', () => {
    const frame = multiply(translate(20, 20), scale(2, 2));
    const layer = createGridLayer({
      spacing: 10,
      scopes: { root: ROOT },
      regions: () => [{ outline: squareIn(frame, 0, 0, 20), chain: [ROOT, HALF], frame }],
      bounds: () => ({ x: 0, y: 0, width: 100, height: 100 }),
    });
    const [, inner] = layer.draw(undefined, VIEW, DIMS);
    const turned = (inner as GroupDrawCommand).children[0] as GroupDrawCommand;
    expect((turned.children[0] as PathDrawCommand).stroke!.width).toBeCloseTo(0.5, 9);
  });
});

describe('sceneGridRegions — frames', () => {
  it('gives a container its box frame, and its outline turned with it', () => {
    const scene = createScene<object, 'default', Bounds>({
      systemLayers: [{ id: 'default', visible: true, locked: false }], composition: RIGID_POSE_COMPOSITION,
    });
    scene.add({ kind: 'group', layer: 'default', pose: { x: 20, y: 20, width: 40, height: 40, rotation: TURN } as Bounds, data: {}, units: HALF });
    const [region] = sceneGridRegions(scene, ROOT);
    const frame = multiply(rotateAboutPoint(40, 40, TURN), translate(20, 20));
    region!.frame!.forEach((v, i) => expect(v).toBeCloseTo(frame[i]!, 9));
    squareIn(frame, 0, 0, 40).forEach((p, i) => {
      expect(region!.outline[i]!.x).toBeCloseTo(p.x, 9);
      expect(region!.outline[i]!.y).toBeCloseTo(p.y, 9);
    });
  });
});

describe('a hovered cell in a turned region', () => {
  const frame = multiply(rotateAboutPoint(40, 40, TURN), translate(20, 20));
  const regions: GridRegion[] = [{ outline: squareIn(frame, 0, 0, 40), chain: [ROOT, HALF], frame }];

  it('is counted in the region\'s frame, and carries it', () => {
    const [x, y] = applyToPoint(frame, 12, 7);
    expect(pointToGridCell({ x, y }, 10, undefined, undefined, { scopes: { root: ROOT }, regions }))
      .toEqual({ col: 2, row: 1, pitch: { x: 5, y: 5 }, frame });
  });

  it('is highlighted in its frame', () => {
    const layer = createCellHighlightLayer({ spacing: 10, getCell: () => ({ col: 2, row: 1, pitch: { x: 5, y: 5 }, frame }) });
    expect(layer.draw(undefined, VIEW, DIMS)[0]).toMatchObject({
      kind: 'group',
      transform: mat3.fromAffine(frame),
      children: [{ path: { kind: 'rect', x: 10, y: 5, width: 5, height: 5 } }],
    });
  });
});
