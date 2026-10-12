import { afterEach, describe, expect, it } from 'vitest';
import { pathFromD } from './paths/pathFromD';
import { pathSignedArea } from './paths/winding';
import { pathIntersectsRect, pointInPath } from './pathHitTest';
import { tessellate } from './tessellate/tessellate';
import { defaultOpenFill, fillsOpenSubpaths, setDefaultOpenFill } from './openFill';
import { translatePath } from './paths/transform';
import { transformPath } from './paths/transformPath';
import { splitSubpaths } from './paths/splitSubpaths';
import { reversePath } from './paths/winding';
import { editAnchorSet } from './paths/anchorEdits';
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
