import { describe, expect, it } from 'vitest';
import { parseSvg } from './parse';

type Fill = { kind: string; paint: Record<string, unknown> };
const fillOf = (svg: string): { fill: Fill; warnings: string[] } => {
  const r = parseSvg(svg);
  const group = r.nodes[0] as { children: { fill: Fill }[] };
  return { fill: group.children[0]!.fill, warnings: r.warnings };
};

const SVG = (transform: string, defs: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" xmlns:wzl="urn:weasel-js:svg"><defs>${defs}</defs>`
  + `<g transform="${transform}"><rect x="0" y="0" width="10" height="10" fill="url(#g)"/></g></svg>`;

const LINEAR = '<linearGradient id="g" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="10" y2="10">'
  + '<stop offset="0" stop-color="#ff0000"/><stop offset="1" stop-color="#0000ff"/></linearGradient>';

describe('a user-space gradient under a group transform', () => {
  it('keeps a linear gradient\'s isolines where they were under a non-uniform scale', () => {
    // Under scale(2, 1) the line through (10, 0) and (0, 10), halfway along,
    // lands on the line through (20, 0) and (0, 10): the gradient now runs
    // perpendicular to that, toward (8, 16), not toward (20, 10).
    const { paint } = fillOf(SVG('scale(2 1)', LINEAR)).fill;
    expect(paint.from).toEqual({ x: 0, y: 0 });
    const to = paint.to as { x: number; y: number };
    expect(to.x).toBeCloseTo(8, 9);
    expect(to.y).toBeCloseTo(16, 9);
  });

  it('turns a conic gradient\'s start angle with a rotation', () => {
    const conic = '<wzl:conicGradient id="g" gradientUnits="userSpaceOnUse" cx="5" cy="5" angle="0">'
      + '<stop offset="0" stop-color="#ff0000"/><stop offset="1" stop-color="#0000ff"/></wzl:conicGradient>';
    const { paint } = fillOf(SVG('rotate(90)', conic)).fill;
    expect(paint.angle as number).toBeCloseTo(Math.PI / 2, 9);
  });

  it('warns that a radial gradient under a non-uniform scale is painted circular', () => {
    const radial = '<radialGradient id="g" gradientUnits="userSpaceOnUse" cx="5" cy="5" r="5">'
      + '<stop offset="0" stop-color="#ff0000"/><stop offset="1" stop-color="#0000ff"/></radialGradient>';
    expect(fillOf(SVG('scale(2 1)', radial)).warnings.join('\n')).toMatch(/radial gradient/);
  });
});
