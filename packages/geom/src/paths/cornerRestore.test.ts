import { describe, expect, it } from 'vitest';
import type { Path, PolygonPath } from '../path';
import { pathFacePieces, pathSubtract, pathUnion } from '../booleans/ops';
import { snipPathsAtCrossings } from '../booleans/snipAtCrossings';
import { pathToAnchors } from './anchors';
import { cornerSpecAt, withCorner, type CornerSpec } from './cornerSpec';
import { restoreCorners, cornerTraces } from './cornerRestore';
import { resolveCorners } from './corners';
import { extendToMeet } from './extendPath';
import { pathFromD } from './pathFromD';
import { trimPathAt } from './trimPath';

const ROUND: CornerSpec = { shape: 'round', radius: 3 };
const BEVEL: CornerSpec = { shape: 'bevel', radius: 2 };

const withCorners = (d: string, specs: Record<number, CornerSpec>): PolygonPath =>
  Object.entries(specs).reduce((p, [i, s]) => withCorner(p, Number(i), s), pathFromD(d) as PolygonPath);

/** Each anchor carrying a spec, keyed by where it sits, to two places. */
const cornersByPoint = (path: Path): Record<string, CornerSpec> => {
  const out: Record<string, CornerSpec> = {};
  if (path.kind !== 'polygon') return out;
  for (const a of pathToAnchors(path).anchors.flat()) {
    if (a.corner) out[`${Math.round(a.x * 100) / 100},${Math.round(a.y * 100) / 100}`] = a.corner;
  }
  return out;
};

const anchorCount = (path: Path) => (path.kind === 'polygon' ? pathToAnchors(path).anchors.flat().length : 4);

describe('restoreCorners', () => {
  it('folds a corner drawn whole back into its anchor', () => {
    const source = withCorners('M0 0 L10 0 L10 10 L0 10 Z', { 1: ROUND, 3: BEVEL });
    const drawn = resolveCorners(source);
    const back = restoreCorners(drawn, cornerTraces(source));
    expect(cornersByPoint(back)).toEqual({ '10,0': ROUND, '0,10': BEVEL });
    expect(anchorCount(back)).toBe(4);
  });

  it('carries a curved edge on to the anchor it folds into', () => {
    const source = withCorners('M0 0 C3 -4 7 -4 10 0 L10 10', { 1: ROUND });
    const back = restoreCorners(resolveCorners(source), cornerTraces(source));
    expect(cornerSpecAt(back, 1)).toEqual(ROUND);
    expect(anchorCount(back)).toBe(3);
  });

  it('leaves a corner expanded when its cut is no longer drawn', () => {
    const source = withCorners('M0 0 L10 0 L10 10', { 1: ROUND });
    const other = withCorners('M0 0 L10 0 L10 10', { 1: { shape: 'round', radius: 4 } });
    const back = restoreCorners(resolveCorners(other), cornerTraces(source));
    expect(back.corners).toBeUndefined();
  });
});

describe('operations keep the corners they leave whole', () => {
  const run = () => withCorners('M0 0 L10 0 L10 10 L0 10', { 1: ROUND, 2: BEVEL });

  it('Trim segment keeps the corners away from the cut', () => {
    const cut = pathFromD('M5 -5 L5 5');
    const trimmed = trimPathAt(run(), [cut], { x: 1, y: 0 })!.path;
    expect(cornersByPoint(trimmed)).toEqual({ '10,0': ROUND, '10,10': BEVEL });
  });

  it('Trim segment drops a corner it cuts through', () => {
    // Through the round corner's middle, crossing nothing else.
    const cut = pathFromD('M7 3 L12 -2');
    const trimmed = trimPathAt(run(), [cut], { x: 1, y: 0 })!.path;
    expect(cornersByPoint(trimmed)).toEqual({ '10,10': BEVEL });
  });

  it('Cut at crossings gives each piece the corners it holds whole', () => {
    const cut = pathFromD('M5 -5 L5 15');
    const [pieces] = snipPathsAtCrossings([run(), cut]);
    expect(pieces!.map(cornersByPoint)).toEqual([{}, { '10,0': ROUND, '10,10': BEVEL }, {}]);
  });

  it('Extend to next path keeps the corners behind the end it grows', () => {
    const wall = pathFromD('M-20 0 L-20 20');
    const extended = extendToMeet(run(), [wall], { sub: 0, end: 'last' })!.path;
    expect(cornersByPoint(extended)).toEqual({ '10,0': ROUND, '10,10': BEVEL });
  });

  it('a union keeps the corners the other shape does not reach', () => {
    const square = withCorners('M0 0 L10 0 L10 10 L0 10 Z', { 1: ROUND, 3: BEVEL });
    const out = pathUnion(square, pathFromD('M-5 -5 L5 -5 L5 5 L-5 5 Z'));
    expect(cornersByPoint(out)).toEqual({ '10,0': ROUND, '0,10': BEVEL });
  });

  it('a subtraction biting into a corner drops only that one', () => {
    const square = withCorners('M0 0 L10 0 L10 10 L0 10 Z', { 1: ROUND, 3: BEVEL });
    const out = pathSubtract(square, pathFromD('M8 -2 L12 -2 L12 2 L8 2 Z'));
    expect(cornersByPoint(out)).toEqual({ '0,10': BEVEL });
  });

  it('the faces a shape is cut into keep its corners, on either side of the cut', () => {
    const square = withCorners('M0 0 L10 0 L10 10 L0 10 Z', { 1: ROUND, 3: BEVEL });
    const faces = pathFacePieces(square, pathFromD('M5 -5 L15 -5 L15 15 L5 15 Z'));
    // The face outside the square is bounded by the round corner's arc too,
    // so it holds that corner, turned the other way.
    expect(faces.map((f) => [f.sources, cornersByPoint(f.path)])).toEqual([
      [[0], { '0,10': BEVEL }],
      [[1], { '10,0': ROUND }],
      [[0, 1], { '10,0': ROUND }],
    ]);
  });
});
