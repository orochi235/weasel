/** Counterexamples the exporter properties shrank to, kept as plain examples. */
import { describe, it, expect } from 'vitest';
import { parseSvg } from './parse';
import { serializeSvg } from './serialize';
import type { SvgNode, SvgPathNode } from './types';

const unit = { kind: 'rect', x: 0, y: 0, width: 1, height: 1 } as const;

describe('serializeSvg (shrunk counterexamples)', () => {
  it('states a group paint\'s opacity where a group above set one, so a leaf inheriting it is not faded', () => {
    const nodes: SvgNode[] = [{
      kind: 'group', fill: { kind: 'solid', color: '#000000', opacity: 0 }, children: [{
        kind: 'group', fill: { kind: 'solid', color: '#000000' }, children: [
          { kind: 'path', path: unit, fill: { kind: 'solid', color: '#000000' }, inherits: { fill: true } },
        ],
      }],
    }];
    const leaf = (ns: SvgNode[]): SvgPathNode => (ns[0]!.kind === 'group' ? leaf(ns[0]!.children) : ns[0] as SvgPathNode);
    expect(leaf(parseSvg(serializeSvg(nodes)).nodes).fill).toEqual({ kind: 'solid', color: '#000000', opacity: 1 });
  });

  it('writes a viewBox past 1e302 as the number it is, not Infinity', () => {
    const xml = serializeSvg([], { viewBox: { x: 1e303, y: 0, width: 1, height: 1 } });
    expect(xml).toContain('viewBox="1e+303 0 1 1"');
    expect(parseSvg(xml).viewBox?.x).toBe(1e303);
  });
});
