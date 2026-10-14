import { describe, expect, it } from 'vitest';
import { pathFromD, type PolygonPath } from '@weasel-js/core';
import { serializeSvg } from './serialize';
import type { SvgNode, SvgPathNode } from './types';

const RED = { kind: 'solid', color: '#ff0000' } as const;
const STROKE = { paint: { kind: 'solid', color: '#000000' }, width: 2 } as const;
const ENDS = { ...STROKE, markerStart: 'circle', markerEnd: 'arrow' } as const;
const node = (d: string, extra: Partial<SvgPathNode> = {}): SvgPathNode => ({
  kind: 'path',
  path: { ...(pathFromD(d) as PolygonPath), openFill: 'close' },
  fill: { kind: 'none' },
  ...extra,
});
const paths = (n: SvgNode) => serializeSvg([n]).replace(/<defs>[\s\S]*<\/defs>/, '').match(/<path [^>]*>/g)!;
const dOf = (p: string) => /d="([^"]*)"/.exec(p)![1];
const TWO_OPEN = 'M0 0L10 0 M20 0L30 0L30 10';

describe('svg export: a marked stroke draws one pair of end markers per open subpath', () => {
  it('writes each open subpath of an unfilled path as its own path', () => {
    const out = paths(node(TWO_OPEN, { stroke: ENDS }));
    expect(out.map(dOf)).toEqual(['M0 0L10 0', 'M20 0L30 0L30 10']);
    expect(out.every((p) => p.includes('marker-start=') && p.includes('marker-end=') && p.includes('fill="none"'))).toBe(true);
  });

  it('writes a fill that closes its open subpaths once, under the strokes', () => {
    const out = paths(node(TWO_OPEN, { fill: RED, stroke: ENDS }));
    expect(out.map(dOf)).toEqual(['M0 0L10 0M20 0L30 0L30 10', 'M0 0L10 0', 'M20 0L30 0L30 10']);
    expect(out[0]).toContain('fill="#ff0000"');
    expect(out[0]).toContain('stroke="none"');
    expect(out[0]).not.toMatch(/marker-/);
    expect(out.slice(1).every((p) => p.includes('fill="none"') && p.includes('marker-end='))).toBe(true);
  });

  it('keeps an even-odd hole a hole when the strokes are split off', () => {
    const ring = { ...(pathFromD('M0 0L30 0L30 30L0 30Z M10 10L20 10L20 20L10 20Z M40 0L50 0') as PolygonPath), fillRule: 'evenodd' as const, openFill: 'close' as const };
    const out = paths({ kind: 'path', path: ring, fill: RED, stroke: ENDS });
    expect(out).toHaveLength(4);
    expect(out[0]).toContain('fill-rule="evenodd"');
    expect(dOf(out[0])).toBe('M0 0L30 0L30 30L0 30ZM10 10L20 10L20 20L10 20ZM40 0L50 0');
  });

  it('writes no start or end marker on a closed subpath, alone or among others', () => {
    const [alone] = paths(node('M0 0L10 0L10 10Z', { fill: RED, stroke: ENDS }));
    expect(alone).not.toMatch(/marker-(start|end)=/);
    expect(alone).toContain('fill="#ff0000"');

    const [closed, open] = paths(node('M0 0L10 0L10 10Z M20 0L30 0', { stroke: ENDS }));
    expect(closed).not.toMatch(/marker-(start|end)=/);
    expect(open).toMatch(/marker-start=.*marker-end=/);
  });

  it('writes each subpath of a mid-marked stroke as its own path, so no join is marked', () => {
    const out = paths(node(TWO_OPEN, { stroke: { ...STROKE, markerMid: 'square' } }));
    expect(out.map(dOf)).toEqual(['M0 0L10 0', 'M20 0L30 0L30 10']);
  });

  it('leaves a single open subpath, and any unmarked stroke, as one path', () => {
    expect(paths(node('M0 0L10 0L10 10', { fill: RED, stroke: ENDS }))).toHaveLength(1);
    expect(paths(node(TWO_OPEN, { fill: RED, stroke: STROKE }))).toHaveLength(1);
    expect(paths(node(TWO_OPEN, { fill: RED }))).toHaveLength(1);
  });

  it('carries opacity onto the group, not onto each piece', () => {
    const out = serializeSvg([node(TWO_OPEN, { fill: RED, stroke: ENDS, opacity: 0.5 })]);
    expect(out).toMatch(/<g opacity="0.5">/);
    expect(out.match(/opacity="0.5"/g)).toHaveLength(1);
  });
});
