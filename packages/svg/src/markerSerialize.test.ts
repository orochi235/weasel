import { describe, it, expect } from 'vitest';
import { getMarker, pathFromD, registerMarker } from '@weasel-js/core';
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

  it('says so when it leaves out a marker no registry entry backs', () => {
    const warnings: string[] = [];
    const out = serializeSvg(line({ markerEnd: 'never-registered' }), { onWarn: (m) => warnings.push(m) });
    expect(out).not.toContain('marker-end');
    expect(warnings).toEqual(['marker "never-registered" is not registered, so the stroke is written without it']);
  });

  it('says so for a text stroke too', () => {
    const warnings: string[] = [];
    serializeSvg([{
      kind: 'text', x: 0, y: 0, width: 10, height: 10, text: 'a',
      stroke: { paint: { kind: 'solid', color: '#000' }, width: 1, markerEnd: 'never-registered' },
    } as SvgNode], { onWarn: (m) => warnings.push(m) });
    expect(warnings).toContain('marker "never-registered" is not registered, so the stroke is written without it');
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

  it('draws a mid dot centered on refX, as the renderer centers it on the vertex', () => {
    const out = serializeSvg(line({ markerMid: 'dot' }));
    const def = /<marker id="dot"[^>]*refX="0"[^>]*><path d="([^"]+)"/.exec(out);
    expect(def).not.toBeNull();
    const xs = [...def![1].matchAll(/[ML](-?[\d.]+)/g)].map((m) => Number(m[1]));
    expect(Math.max(...xs) + Math.min(...xs)).toBeCloseTo(0, 3);
    const { nodes, warnings } = parseSvg(out);
    expect(warnings).toEqual([]);
    expect((nodes[0] as { stroke?: { markerMid?: string } }).stroke?.markerMid).toBe('dot');
  });
});

describe('a marker key that is not an XML id', () => {
  it('writes a well-formed def and reads the key back', () => {
    const key = 'my "arrow" & <co>';
    const arrow = getMarker('arrow')!;
    const unregister = registerMarker({ ...arrow, id: key });
    try {
      const svg = serializeSvg(line({ markerEnd: key }));
      const { nodes, warnings } = parseSvg(svg);
      expect(warnings).toEqual([]);
      expect((nodes[0] as { stroke?: { markerEnd?: string } }).stroke?.markerEnd).toBe(key);
    } finally {
      unregister();
    }
  });
});

describe('a marker key that is not an XML id, unregistered by the time it is read', () => {
  it('reads both references of a seated head back under the key, with its inset', () => {
    const arrow = getMarker('arrow')!;
    const key = 'my tick';
    const unregister = registerMarker({ ...arrow, id: key, inset: 2 });
    const svg = serializeSvg(line({ markerStart: key, markerEnd: { key, size: 3 } }));
    unregister();
    const parsed = parseSvg(svg);
    expect(parsed.warnings).toEqual([]);
    expect(parsed.markers?.map((m) => [m.id, m.inset])).toEqual([[key, 2]]);
    const stroke = (parsed.nodes[0] as { stroke?: Record<string, unknown> }).stroke!;
    expect([stroke.markerStart, stroke.markerEnd]).toEqual([key, { key, size: 3 }]);
  });
});

describe('a sized head read back under a scaling group', () => {
  it('scales the head with the stroke, as a browser draws its userSpaceOnUse def', () => {
    const svg = serializeSvg(line({ markerEnd: { key: 'arrow', size: 3 } }));
    const at = svg.lastIndexOf('<path ');
    const end = svg.indexOf('/>', at) + 2;
    const wrapped = `${svg.slice(0, at)}<g transform="scale(2)">${svg.slice(at, end)}</g>${svg.slice(end)}`;
    let node = parseSvg(wrapped).nodes[0] as { kind: string; children?: unknown[]; stroke?: Record<string, unknown> };
    while (node.kind === 'group') node = node.children![0] as typeof node;
    expect(node.stroke!.width).toBe(4);
    expect(node.stroke!.markerEnd).toEqual({ key: 'arrow', size: 6 });
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
