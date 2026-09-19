import { describe, it, expect } from 'vitest';
import { parseSvg } from './parse';
import type { SvgPathNode, SvgTextNode } from './types';
import { serializeSvg } from './serialize';
import { registerMarker, type MarkerEntry, type PolygonPath } from '@weasel-js/core';

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

  it('warns and drops a marker the document does not define', () => {
    const { nodes, warnings, markers } = parseSvg(wrap(
      '<line x1="0" y1="0" x2="50" y2="0" stroke="#000" marker-end="url(#nowhere)"/>',
    ));
    expect((nodes[0] as SvgPathNode).stroke?.markerEnd).toBeUndefined();
    expect(warnings.join(' ')).toContain('nowhere');
    expect(markers).toBeUndefined();
  });

  it('does not warn about a <marker> def on its own', () => {
    const { warnings } = parseSvg(wrap(
      '<defs><marker id="arrow"><path d="M0 0 L5 5"/></marker></defs>' +
      '<line x1="0" y1="0" x2="50" y2="0" stroke="#000" marker-end="url(#arrow)"/>',
    ));
    expect(warnings.filter((w) => w.includes('unsupported'))).toEqual([]);
  });
});

/** A marker's geometry at `size`, as plain rounded numbers. */
const coordsOf = (entry: MarkerEntry, size = 1): number[] => Array.from(
  (entry.path({ size, stroke: { paint: { color: '#000' } } }) as PolygonPath).coords,
  (v) => Math.round(v * 1e4) / 1e4 + 0,
);

// A hand-written arrowhead in the shape most SVG in the wild uses: a 10x10
// viewBox drawn pointing +X, anchored at its tip by refX / refY, sized by
// markerWidth / markerHeight in stroke widths.
const TRI = '<marker id="tri" viewBox="0 0 10 10" refX="10" refY="5" markerWidth="6"'
  + ' markerHeight="6" orient="auto"><path d="M0 0 L10 5 L0 10 Z" fill="#ff0000"/></marker>';
const lineWith = (attrs: string, defs = TRI, strokeWidth = 2) => wrap(
  `<defs>${defs}</defs><line x1="0" y1="0" x2="50" y2="0" stroke="#000"`
  + ` stroke-width="${strokeWidth}" ${attrs}/>`,
);

describe('ingesting a marker the kit has no key for', () => {
  it('reads its geometry, anchor, paint and orientation into an entry', () => {
    const { nodes, warnings, markers } = parseSvg(lineWith('marker-end="url(#tri)"'));
    expect(warnings).toEqual([]);
    const key = (nodes[0] as SvgPathNode).stroke?.markerEnd;
    expect(key).toMatch(/^tri-/);
    expect(markers).toHaveLength(1);
    const entry = markers![0];
    expect(entry.id).toBe(key);
    // viewBox 10 -> markerWidth 6 is 0.6 stroke widths per unit, and refX/refY
    // (10, 5) lands on the origin: the tip at 0, the back 6 units behind it.
    expect(coordsOf(entry)).toEqual([-6, -3, 0, 0, -6, 3]);
    expect(coordsOf(entry, 2)).toEqual([-12, -6, 0, 0, -12, 6]);
    expect(entry.fill).toEqual({ color: '#ff0000' });
    expect(entry.outline).toBeFalsy();
    expect(entry.orient).toBe('auto');
    expect(entry.inset ?? 0).toBe(0);
  });

  it('turns an orient="auto" start marker around, since the kit reverses every start', () => {
    const { nodes, markers } = parseSvg(lineWith('marker-start="url(#tri)" marker-end="url(#tri)"'));
    const stroke = (nodes[0] as SvgPathNode).stroke!;
    expect(stroke.markerStart).not.toBe(stroke.markerEnd);
    const start = markers!.find((m) => m.id === stroke.markerStart)!;
    expect(coordsOf(start)).toEqual([6, 3, 0, 0, 6, -3]);
  });

  it('leaves an auto-start-reverse start marker as drawn', () => {
    const { nodes, markers } = parseSvg(lineWith(
      'marker-start="url(#tri)"', TRI.replace('orient="auto"', 'orient="auto-start-reverse"'),
    ));
    const start = markers!.find((m) => m.id === (nodes[0] as SvgPathNode).stroke!.markerStart)!;
    expect(coordsOf(start)).toEqual([-6, -3, 0, 0, -6, 3]);
  });

  it('reads a fixed orient as radians, and an absent one as SVG\'s 0', () => {
    const fixed = parseSvg(lineWith('marker-end="url(#tri)"', TRI.replace('orient="auto"', 'orient="45"')));
    expect(fixed.markers![0].orient).toBeCloseTo(Math.PI / 4);
    const none = parseSvg(lineWith('marker-end="url(#tri)"', TRI.replace(' orient="auto"', '')));
    expect(none.markers![0].orient).toBe(0);
  });

  it('reads userSpaceOnUse geometry in the referencing stroke\'s widths', () => {
    const def = '<marker id="u" markerUnits="userSpaceOnUse" refX="4" refY="2">'
      + '<path d="M0 0 L4 2 L0 4 Z"/></marker>';
    const { markers } = parseSvg(lineWith('marker-end="url(#u)"', def, 2));
    expect(coordsOf(markers![0])).toEqual([-2, -1, 0, 0, -2, 1]);
  });

  it('reads an outline, and context-stroke as the line\'s own paint', () => {
    const def = '<marker id="v" refX="5" refY="5" orient="auto">'
      + '<path d="M0 0 L5 5 L0 10" fill="none" stroke="context-stroke" stroke-width="1.5"/></marker>';
    const { warnings, markers } = parseSvg(lineWith('marker-end="url(#v)"', def));
    expect(warnings).toEqual([]);
    expect(markers![0].fill).toBe('none');
    expect(markers![0].outline).toEqual({ width: 1.5, paint: 'line' });
  });

  it('keys two different markers that share an id apart', () => {
    const a = parseSvg(lineWith('marker-end="url(#tri)"')).markers![0];
    const b = parseSvg(lineWith('marker-end="url(#tri)"', TRI.replace('#ff0000', '#0000ff'))).markers![0];
    expect(a.id).not.toBe(b.id);
  });

  it('reads a marker on a text stroke too', () => {
    const { nodes, markers } = parseSvg(wrap(
      `<defs>${TRI}</defs><text x="0" y="0" stroke="#000" marker-end="url(#tri)">A</text>`,
    ));
    expect((nodes[0] as SvgTextNode).stroke?.markerEnd).toBe(markers![0].id);
  });

  it('round-trips through export under the same key, registered or not', () => {
    const first = parseSvg(lineWith('marker-start="url(#tri)" marker-end="url(#tri)"'));
    const disposers = first.markers!.map(registerMarker);
    const out = serializeSvg(first.nodes);
    disposers.forEach((d) => d());

    // Read back in a session that never registered them.
    const again = parseSvg(out);
    expect(again.warnings).toEqual([]);
    const s1 = (first.nodes[0] as SvgPathNode).stroke!;
    const s2 = (again.nodes[0] as SvgPathNode).stroke!;
    expect(s2.markerStart).toBe(s1.markerStart);
    expect(s2.markerEnd).toBe(s1.markerEnd);
    for (const m of first.markers!) {
      const back = again.markers!.find((x) => x.id === m.id)!;
      expect(coordsOf(back)).toEqual(coordsOf(m));
      expect(back.fill).toEqual(m.fill);
      expect(back.orient).toEqual(m.orient);
    }
  });
});
