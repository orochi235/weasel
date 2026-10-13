import { afterEach, describe, expect, it } from 'vitest';
import { pathFromD } from './paths/pathFromD';
import { pathSignedArea } from './paths/winding';
import {
  pathContainsRect, pathIntersectsPolygon, pathIntersectsRect, pointInPath, strokeHitTest,
} from './pathHitTest';
import { tessellate } from './tessellate/tessellate';
import { defaultOpenFill, fillsOpenSubpaths, setDefaultOpenFill } from './openFill';
import { translatePath } from './paths/transform';
import { transformPath } from './paths/transformPath';
import { splitSubpaths } from './paths/splitSubpaths';
import { reversePath } from './paths/winding';
import { editAnchorSet } from './paths/anchorEdits';
import { pathToMultiPolygon } from './booleans/adapter';
import { parseContours } from './booleans/contours';
import { pathIntersect } from './booleans';
import type { PathOpenFill, PolygonPath } from './path';

/** A right triangle whose last edge, back to (0,0), is never drawn. */
const open = (openFill?: PathOpenFill): PolygonPath => ({
  ...(pathFromD('M0 0 L100 0 L100 100') as PolygonPath),
  ...(openFill ? { openFill } : {}),
});
const INSIDE = [75, 25] as const;

afterEach(() => setDefaultOpenFill('close'));

describe('whether an open subpath fills', () => {
  it('starts out closing it, as SVG and canvas do', () => {
    expect(defaultOpenFill()).toBe('close');
    expect(fillsOpenSubpaths(open())).toBe(true);
  });

  it.each([
    ['close', true],
    ['none', false],
  ] as const)('answers painting, area, and picking alike under %s', (rule, fills) => {
    const path = open(rule);
    expect(tessellate(path).indices.length > 0).toBe(fills);
    expect(pathSignedArea(path) !== 0).toBe(fills);
    expect(pointInPath(path, ...INSIDE)).toBe(fills);
  });

  it('reads the engine default for a path that names no rule', () => {
    setDefaultOpenFill('none');
    const path = open();
    expect(tessellate(path).indices.length).toBe(0);
    expect(pathSignedArea(path)).toBe(0);
    expect(pointInPath(path, ...INSIDE)).toBe(false);
  });

  it("keeps a path's own rule over the engine default", () => {
    setDefaultOpenFill('none');
    expect(pointInPath(open('close'), ...INSIDE)).toBe(true);
    expect(tessellate(open('close')).indices.length).toBe(3);
  });

  it('leaves a closed subpath filled under either rule', () => {
    const closed: PolygonPath = { ...(pathFromD('M0 0 L100 0 L100 100 Z') as PolygonPath), openFill: 'none' };
    expect(tessellate(closed).indices.length).toBe(3);
    expect(pathSignedArea(closed)).toBe(5000);
    expect(pointInPath(closed, ...INSIDE)).toBe(true);
  });

  it('fills only the closed contour of a path that mixes the two under none', () => {
    const mixed: PolygonPath = {
      ...(pathFromD('M0 0 L100 0 L100 100 Z M200 0 L300 0 L300 100') as PolygonPath),
      openFill: 'none',
    };
    expect(tessellate(mixed).indices.length).toBe(3);
    expect(pathSignedArea(mixed)).toBe(5000);
    expect(pointInPath(mixed, 275, 25)).toBe(false);
  });

  it('gives a boolean only the contours a fill covers', () => {
    const mixed = (rule: PathOpenFill): PolygonPath => ({
      ...(pathFromD('M0 0 L100 0 L100 100 Z M200 0 L300 0 L300 100') as PolygonPath),
      openFill: rule,
    });
    expect(pathToMultiPolygon(mixed('close'))).toHaveLength(2);
    expect(pathToMultiPolygon(mixed('none'))).toHaveLength(1);
    expect(pathToMultiPolygon(open('none'))).toEqual([]);
    expect(parseContours(mixed('close'))).toHaveLength(2);
    expect(parseContours(mixed('none'))).toHaveLength(1);
    const rect = { kind: 'rect', x: 250, y: 10, width: 500, height: 20 } as const;
    const drawn = (rule: PathOpenFill) => (pathIntersect(mixed(rule), rect) as PolygonPath).commands.length;
    expect(drawn('close')).toBeGreaterThan(0);
    expect(drawn('none')).toBe(0);
    setDefaultOpenFill('none');
    expect(pathToMultiPolygon(open())).toEqual([]);
  });

  it('counts a rect wholly inside the closed-over region as meeting the path', () => {
    const inner = { x: 70, y: 20, width: 10, height: 10 };
    expect(pathIntersectsRect(open('close'), inner)).toBe(true);
    expect(pathIntersectsRect(open('none'), inner)).toBe(false);
  });

  it.each([
    ['translatePath', (p: PolygonPath) => translatePath(p, 5, 5)],
    ['transformPath', (p: PolygonPath) => transformPath(p, [2, 0, 0, 2, 0, 0])],
    ['reversePath', (p: PolygonPath) => reversePath(p)],
    ['splitSubpaths', (p: PolygonPath) => splitSubpaths(p)[0]],
    ['editAnchorSet', (p: PolygonPath) => editAnchorSet(p, (set) => { set.anchors[0][0].x += 1; })],
  ] as const)('%s hands back a path with the same fill rules', (_name, reshape) => {
    const source: PolygonPath = { ...open('none'), fillRule: 'evenodd' };
    const out = reshape(source) as PolygonPath;
    expect(out.openFill).toBe('none');
    expect(out.fillRule).toBe('evenodd');
  });
});

describe('everything that asks about a fill agrees on an open subpath it closes', () => {
  const OPEN_TRIANGLE = open('close');

  it('contains a point the triangle paints, and not one past its closing edge', () => {
    expect(pointInPath(OPEN_TRIANGLE, 75, 25)).toBe(true);
    expect(pointInPath(OPEN_TRIANGLE, 25, 75)).toBe(false);
  });

  it('answers region questions against the same triangle', () => {
    expect(pathContainsRect(OPEN_TRIANGLE, { x: 70, y: 20, width: 10, height: 10 })).toBe(true);
    // Straddles the closing edge, which no command draws.
    expect(pathContainsRect(OPEN_TRIANGLE, { x: 45, y: 45, width: 10, height: 10 })).toBe(false);
    expect(pathIntersectsRect(OPEN_TRIANGLE, { x: 45, y: 45, width: 10, height: 10 })).toBe(true);
    expect(pathIntersectsPolygon(OPEN_TRIANGLE, [{ x: 70, y: 20 }, { x: 80, y: 20 }, { x: 75, y: 30 }])).toBe(true);
  });

  it('closes a curved run the same way', () => {
    const lobe = pathFromD('M0 0 C0 100 100 100 100 0') as PolygonPath;
    expect(pointInPath(lobe, 50, 40)).toBe(true);
    expect(pointInPath(lobe, 50, 90)).toBe(false);
  });

  it('fills nothing for a run of two points', () => {
    const line = pathFromD('M0 0 L100 100');
    expect(pointInPath(line, 50, 50)).toBe(false);
    expect(tessellate(line).indices.length).toBe(0);
  });

  it('leaves the stroke open: the closing edge is not part of the outline', () => {
    expect(strokeHitTest(OPEN_TRIANGLE, 50, 50, 2)).toBe(false);
    expect(strokeHitTest(OPEN_TRIANGLE, 50, 0, 2)).toBe(true);
  });
});
