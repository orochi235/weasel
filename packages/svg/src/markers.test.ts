import { describe, it, expect } from 'vitest';
import { parseSvg } from './parse';
import type { SvgPathNode } from './types';

const wrap = (body: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100">${body}</svg>`;

describe('marker parsing', () => {
  it('reads a known key off marker-end', () => {
    const { nodes } = parseSvg(wrap(
      '<line x1="0" y1="0" x2="50" y2="0" stroke="#000" marker-end="url(#arrow)"/>',
    ));
    expect((nodes[0] as SvgPathNode).stroke?.markerEnd).toBe('arrow');
  });

  it('reads all three positions', () => {
    const { nodes } = parseSvg(wrap(
      '<polyline points="0,0 25,25 50,0" stroke="#000" ' +
      'marker-start="url(#circle)" marker-mid="url(#square)" marker-end="url(#arrow)"/>',
    ));
    const path = nodes[0] as SvgPathNode;
    expect(path.stroke?.markerStart).toBe('circle');
    expect(path.stroke?.markerMid).toBe('square');
    expect(path.stroke?.markerEnd).toBe('arrow');
  });

  it('inherits markers from a parent group', () => {
    const { nodes } = parseSvg(wrap(
      '<g stroke="#000" marker-end="url(#arrow)"><line x1="0" y1="0" x2="50" y2="0"/></g>',
    ));
    const group = nodes[0] as { children: typeof nodes };
    expect((group.children[0] as SvgPathNode).stroke?.markerEnd).toBe('arrow');
  });

  it('treats marker-end="none" as absent', () => {
    const { nodes } = parseSvg(wrap(
      '<line x1="0" y1="0" x2="50" y2="0" stroke="#000" marker-end="none"/>',
    ));
    expect((nodes[0] as SvgPathNode).stroke?.markerEnd).toBeUndefined();
  });

  it('warns and drops a marker we have no key for', () => {
    const { nodes, warnings } = parseSvg(wrap(
      '<defs><marker id="custom"><path d="M0 0 L5 5"/></marker></defs>' +
      '<line x1="0" y1="0" x2="50" y2="0" stroke="#000" marker-end="url(#custom)"/>',
    ));
    expect((nodes[0] as SvgPathNode).stroke?.markerEnd).toBeUndefined();
    expect(warnings.join(' ')).toContain('custom');
  });

  it('does not warn about a <marker> def on its own', () => {
    const { warnings } = parseSvg(wrap(
      '<defs><marker id="arrow"><path d="M0 0 L5 5"/></marker></defs>' +
      '<line x1="0" y1="0" x2="50" y2="0" stroke="#000" marker-end="url(#arrow)"/>',
    ));
    expect(warnings.filter((w) => w.includes('unsupported'))).toEqual([]);
  });
});
