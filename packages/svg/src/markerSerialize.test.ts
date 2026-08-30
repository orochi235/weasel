import { describe, it, expect } from 'vitest';
import { pathFromD } from '@weasel-js/core';
import { serializeSvg } from './serialize';
import { parseSvg } from './parse';
import type { SvgNode } from './types';

const line = (extra: Record<string, unknown> = {}): SvgNode[] => [{
  kind: 'path' as const,
  path: pathFromD('M0 0 L50 0'),
  fill: { kind: 'none' as const },
  stroke: { paint: { kind: 'solid' as const, color: '#000' }, width: 2, ...extra },
} as SvgNode];

describe('marker serialization', () => {
  it('emits the attribute and a matching def', () => {
    const out = serializeSvg(line({ markerEnd: 'arrow' }));
    expect(out).toMatch(/marker-end="url\(#[^)]+\)"/);
    const id = /marker-end="url\(#([^)]+)\)"/.exec(out)![1];
    expect(out).toContain(`<marker id="${id}"`);
    expect(out.indexOf('<defs>')).toBeLessThan(out.indexOf('marker-end='));
  });

  it('emits one def for a key used many times', () => {
    const many = [...line({ markerEnd: 'arrow' }), ...line({ markerEnd: 'arrow' })];
    const out = serializeSvg(many);
    expect(out.match(/<marker /g)).toHaveLength(1);
  });

  it('emits full-length path data, not the trimmed geometry', () => {
    // serializePathD joins commands with no separator (established
    // elsewhere in this package), so the untrimmed 50-unit line reads
    // "M0 0L50 0" rather than "M0 0 L50 0".
    const out = serializeSvg(line({ markerEnd: 'arrow' }));
    expect(out).toContain('M0 0L50 0');
  });

  it('round-trips every position', () => {
    const svg = serializeSvg(
      line({ markerStart: 'circle', markerMid: 'square', markerEnd: 'arrow' }),
    );
    const { nodes, warnings } = parseSvg(svg);
    expect(warnings).toEqual([]);
    expect((nodes[0] as { stroke?: { markerStart?: string; markerMid?: string; markerEnd?: string } }).stroke?.markerStart).toBe('circle');
    expect((nodes[0] as { stroke?: { markerStart?: string; markerMid?: string; markerEnd?: string } }).stroke?.markerMid).toBe('square');
    expect((nodes[0] as { stroke?: { markerStart?: string; markerMid?: string; markerEnd?: string } }).stroke?.markerEnd).toBe('arrow');
  });
});

describe('an unregistered marker key', () => {
  it('emits no attribute rather than a reference to a def that never exists', () => {
    // markerId mints the id, toDefsXml skips entries with no registry match —
    // so emitting unconditionally would leave a dangling IDREF that our own
    // parser tolerates and every other tool does not.
    const out = serializeSvg(line({ markerEnd: 'app-not-registered' }) as never);
    expect(out).not.toContain('marker-end=');
    expect(out).not.toContain('<marker ');
  });
});
