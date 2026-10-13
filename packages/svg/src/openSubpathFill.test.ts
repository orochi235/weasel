import { afterEach, describe, expect, it } from 'vitest';
import { pathFromD, type PolygonPath } from '@weasel-js/core';
import { setDefaultOpenFill } from '@weasel-js/geom';
import { parseSvg } from './parse';
import { serializeSvg } from './serialize';
import type { SvgNode, SvgPathNode } from './types';

const parse = (body: string) => parseSvg(`<svg xmlns="http://www.w3.org/2000/svg">${body}</svg>`);
const pathOf = (body: string) => (parse(body).nodes[0] as SvgPathNode).path as PolygonPath;
const RED = { kind: 'solid', color: '#ff0000' } as const;
const STROKE = { paint: { kind: 'solid', color: '#000000' }, width: 2 } as const;
const node = (d: string, extra: Partial<SvgPathNode> = {}, openFill?: 'none' | 'close'): SvgPathNode => ({
  kind: 'path',
  path: { ...(pathFromD(d) as PolygonPath), ...(openFill ? { openFill } : {}) },
  fill: RED,
  ...extra,
});
const OPEN = 'M0 0L10 0L10 10';
const MIXED = 'M0 0L10 0L10 10Z M20 0L30 0L30 10';

afterEach(() => setDefaultOpenFill('close'));

describe('svg import: an open subpath fills, as SVG fills it', () => {
  it('stamps a polyline and an open path as closed by a fill', () => {
    expect(pathOf('<polyline points="0,0 10,0 10,10" fill="red"/>').openFill).toBe('close');
    expect(pathOf(`<path d="${OPEN}" fill="red"/>`).openFill).toBe('close');
    expect(pathOf(`<path d="${MIXED}" fill="red"/>`).openFill).toBe('close');
  });

  it('leaves a path with no open subpath naming no rule', () => {
    expect(pathOf('<path d="M0 0L10 0L10 15Z" fill="red"/>').openFill).toBeUndefined();
    expect(pathOf('<polygon points="0,0 10,0 10,15" fill="red"/>').openFill).toBeUndefined();
  });

  it('keeps an imported polyline filled through an export under a none default', () => {
    setDefaultOpenFill('none');
    const { nodes } = parse('<polyline points="0,0 10,0 10,10" fill="#ff0000"/>');
    expect(serializeSvg(nodes)).toContain('fill="#ff0000"');
  });
});

describe('svg export: an open subpath no fill closes is written unfilled', () => {
  const write = (n: SvgNode) => serializeSvg([n]);

  it('writes a path of open subpaths with no fill', () => {
    const out = write(node(OPEN, { stroke: STROKE }, 'none'));
    expect(out).toContain('fill="none"');
    expect(out).not.toContain('#ff0000');
    expect(out).toContain('stroke="#000000"');
  });

  it('reads the engine default for a path that names no rule', () => {
    expect(write(node(OPEN))).toContain('fill="#ff0000"');
    setDefaultOpenFill('none');
    expect(write(node(OPEN))).not.toContain('#ff0000');
    expect(write(node(OPEN, {}, 'close'))).toContain('fill="#ff0000"');
  });

  it('leaves a path with no open subpath alone', () => {
    const closed = node('M0 0L10 0L10 15Z', {}, 'none');
    expect(write(closed)).toContain('fill="#ff0000"');
    expect(write(closed)).not.toContain('<g');
  });

  it('splits a path mixing closed and open subpaths into a filled and an unfilled one', () => {
    const out = write(node(MIXED, { stroke: STROKE, opacity: 0.5 }, 'none'));
    const paths = out.match(/<path [^>]*>/g)!;
    expect(paths).toHaveLength(2);
    expect(paths[0]).toContain('d="M0 0L10 0L10 10Z"');
    expect(paths[0]).toContain('fill="#ff0000"');
    expect(paths[1]).toContain('d="M20 0L30 0L30 10"');
    expect(paths[1]).toContain('fill="none"');
    expect(paths.every((p) => p.includes('stroke="#000000"') && !p.includes('opacity="0.5"'))).toBe(true);
    expect(out).toMatch(/<g opacity="0.5">/);
  });

  it('turns a split path about the center of the whole, not of each half', () => {
    const out = write(node(MIXED, { rotation: Math.PI / 2 }, 'none'));
    const back = parseSvg(out).nodes[0] as { children: SvgPathNode[] };
    // The whole spans x 0..30, y 0..10: a quarter turn about (15, 5) takes
    // (0, 0) to (20, -10) and (20, 0) to (20, 10).
    expect(Array.from((back.children[0].path as PolygonPath).coords.slice(0, 2)).map(Math.round)).toEqual([20, -10]);
    expect(Array.from((back.children[1].path as PolygonPath).coords.slice(0, 2)).map(Math.round)).toEqual([20, 10]);
  });
});

describe('svg export: a split path draws the markers the renderer draws', () => {
  const MARKED = { ...STROKE, markerStart: 'circle', markerMid: 'square', markerEnd: 'arrow' } as const;
  const paths = (n: SvgNode) => serializeSvg([n]).replace(/<defs>[\s\S]*<\/defs>/, '').match(/<path [^>]*>/g)!;
  const dOf = (p: string) => /d="([^"]*)"/.exec(p)![1];

  it('writes no start or end marker on the closed half', () => {
    const [closed, open] = paths(node(MIXED, { stroke: MARKED }, 'none'));
    expect(closed).not.toMatch(/marker-(start|end)=/);
    expect(closed).toContain('marker-mid=');
    expect(open).toMatch(/marker-start=.*marker-mid=.*marker-end=/);
  });

  it('writes each open subpath of a marked stroke as its own path', () => {
    const out = paths(node(`${MIXED} M40 0L50 0`, { stroke: MARKED }, 'none'));
    expect(out.map(dOf)).toEqual(['M0 0L10 0L10 10Z', 'M20 0L30 0L30 10', 'M40 0L50 0']);
    expect(out.slice(1).every((p) => p.includes('marker-start=') && p.includes('marker-end='))).toBe(true);

    const allOpen = paths(node('M0 0L10 0 M20 0L30 0', { stroke: MARKED }, 'none'));
    expect(allOpen.map(dOf)).toEqual(['M0 0L10 0', 'M20 0L30 0']);
    expect(allOpen.every((p) => p.includes('fill="none"') && p.includes('marker-end='))).toBe(true);
  });

  it('keeps the open subpaths of an unmarked stroke in one path', () => {
    expect(paths(node(`${MIXED} M40 0L50 0`, { stroke: STROKE }, 'none'))).toHaveLength(2);
    expect(paths(node('M0 0L10 0 M20 0L30 0', { stroke: STROKE }, 'none'))).toHaveLength(1);
    expect(paths(node(`${MIXED} M40 0L50 0`, { stroke: { ...STROKE, markerMid: 'square' } }, 'none'))).toHaveLength(2);
  });
});
