import { describe, it, expect } from 'vitest';
import { parseSvg, serializeSvg } from './index';
import * as F from './__fixtures__/fixtures';
import { roundTrip } from './testing/roundTrip';

describe('round-trip', () => {
  it('gradient-filled path', () => {
    const { a, b } = roundTrip(F.GRADIENT_SVG);
    expect(b).toEqual(a);
  });

  it('gradientUnits survives both directions', () => {
    const { a, b, warnings } = roundTrip(F.GRADIENT_UNITS_SVG);
    expect(warnings).toEqual([]);
    expect(b).toEqual(a);
    // The serializer used to hardcode `userSpaceOnUse`, so an
    // objectBoundingBox gradient came back reading its 0..1 geometry as page
    // coordinates — a gradient the size of a pixel.
    const fills = a.map((n) => (n as { fill?: { paint?: { units?: string } } }).fill?.paint?.units);
    expect(fills).toEqual(['bounds', 'world']);
  });

  it('stroke styling (linecap, linejoin, dasharray)', () => {
    const { a, b, warnings } = roundTrip(F.STROKE_STYLE_SVG);
    expect(warnings).toEqual([]);
    expect(b).toEqual(a);
  });

  it('stroke markers (start, mid, end)', () => {
    const { a, b, warnings } = roundTrip(F.MARKER_SVG);
    expect(warnings).toEqual([]);
    expect(b).toEqual(a);
  });
});

describe('non-scaling stroke width', () => {
  const PX_STROKE_SVG =
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">'
    + '<path d="M10 10 L90 90" fill="none" stroke="#333" stroke-width="2"'
    + ' vector-effect="non-scaling-stroke"/>'
    + '</svg>';

  it('reads vector-effect as a { px } width', () => {
    const { nodes, warnings } = parseSvg(PX_STROKE_SVG);
    expect(warnings).toEqual([]);
    const n = nodes[0];
    if (n.kind !== 'path') throw new Error('expected path');
    expect(n.stroke?.width).toEqual({ px: 2 });
  });

  it('writes a { px } width back out as the attribute, not a bare number', () => {
    const out = serializeSvg(parseSvg(PX_STROKE_SVG).nodes, {
      viewBox: { x: 0, y: 0, width: 100, height: 100 },
    });
    expect(out).toContain('stroke-width="2"');
    expect(out).toContain('vector-effect="non-scaling-stroke"');
  });

  it('round-trips', () => {
    const { a, b, warnings } = roundTrip(PX_STROKE_SVG);
    expect(warnings).toEqual([]);
    expect(b).toEqual(a);
  });

  // `vector-effect` is one of the few presentation attributes SVG does not
  // inherit, so a group carrying it must not hand it to the children.
  it('does not inherit down a group', () => {
    const svg =
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">'
      + '<g vector-effect="non-scaling-stroke" stroke="#333" stroke-width="2">'
      + '<path d="M10 10 L90 90" fill="none"/>'
      + '</g></svg>';
    const g = parseSvg(svg).nodes[0];
    if (g.kind !== 'group') throw new Error('expected group');
    const n = g.children[0];
    if (n.kind !== 'path') throw new Error('expected path');
    expect(n.stroke?.width).toBe(2);
  });

  it('leaves a plain numeric width alone', () => {
    const svg =
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">'
      + '<path d="M10 10 L90 90" fill="none" stroke="#333" stroke-width="2"/></svg>';
    const nodes = parseSvg(svg).nodes;
    const n = nodes[0];
    if (n.kind !== 'path') throw new Error('expected path');
    expect(n.stroke?.width).toBe(2);
    const out = serializeSvg(nodes, { viewBox: { x: 0, y: 0, width: 100, height: 100 } });
    expect(out).not.toContain('vector-effect');
  });
});
