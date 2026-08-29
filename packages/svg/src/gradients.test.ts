import { describe, it, expect } from 'vitest';
import { parseSvg } from './parse';
import { serializeSvg } from './serialize';
import type { SvgNode } from './types';

function gradientOf(svg: string, index = 0): Record<string, unknown> {
  const node = parseSvg(svg).nodes[index] as { fill: { kind: string; paint: Record<string, unknown> } };
  expect(node.fill.kind).toBe('gradient');
  return node.fill.paint;
}

const RECT = '<rect x="0" y="0" width="10" height="10" fill="url(#g)"/>';

describe('gradient collection', () => {
  it('finds a gradient declared outside <defs>', () => {
    const r = parseSvg(
      `<svg xmlns="http://www.w3.org/2000/svg">`
      + `<linearGradient id="g"><stop offset="0" stop-color="#ff0000"/>`
      + `<stop offset="1" stop-color="#0000ff"/></linearGradient>${RECT}</svg>`,
    );
    expect(r.warnings).toEqual([]);
    const paint = (r.nodes[0] as { fill: { paint: { stops: unknown[] } } }).fill.paint;
    expect(paint.stops).toEqual([
      { offset: 0, color: '#ff0000' },
      { offset: 1, color: '#0000ff' },
    ]);
  });

  it('finds a gradient nested inside a <g>', () => {
    const paint = gradientOf(
      `<svg xmlns="http://www.w3.org/2000/svg"><g>`
      + `<linearGradient id="g"><stop offset="0" stop-color="#ff0000"/></linearGradient>`
      + `</g>${RECT}</svg>`,
      1,
    );
    expect(paint.stops).toHaveLength(1);
  });

  it('inherits stops through xlink:href', () => {
    const paint = gradientOf(
      `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"><defs>`
      + `<linearGradient id="base"><stop offset="0" stop-color="#ff0000"/>`
      + `<stop offset="1" stop-color="#0000ff"/></linearGradient>`
      + `<linearGradient id="g" xlink:href="#base" gradientUnits="userSpaceOnUse" `
      + `x1="0" y1="0" x2="10" y2="0"/></defs>${RECT}</svg>`,
    );
    expect(paint.stops).toEqual([
      { offset: 0, color: '#ff0000' },
      { offset: 1, color: '#0000ff' },
    ]);
    expect(paint.units).toBe('world');
    expect(paint.to).toEqual({ x: 10, y: 0 });
  });

  it('inherits geometry and units through a plain href', () => {
    const paint = gradientOf(
      `<svg xmlns="http://www.w3.org/2000/svg"><defs>`
      + `<linearGradient id="base" gradientUnits="userSpaceOnUse" x1="1" y1="2" x2="3" y2="4">`
      + `<stop offset="0" stop-color="#ff0000"/></linearGradient>`
      + `<linearGradient id="g" href="#base"/></defs>${RECT}</svg>`,
    );
    expect(paint.units).toBe('world');
    expect(paint.from).toEqual({ x: 1, y: 2 });
    expect(paint.to).toEqual({ x: 3, y: 4 });
  });

  it('survives an href cycle', () => {
    const paint = gradientOf(
      `<svg xmlns="http://www.w3.org/2000/svg"><defs>`
      + `<linearGradient id="a" href="#g"/><linearGradient id="g" href="#a"/>`
      + `</defs>${RECT}</svg>`,
    );
    expect(paint.stops).toEqual([]);
  });

  it('warns rather than silently mispainting a gradientTransform', () => {
    const r = parseSvg(
      `<svg xmlns="http://www.w3.org/2000/svg"><defs>`
      + `<linearGradient id="g" gradientTransform="rotate(45)">`
      + `<stop offset="0" stop-color="#ff0000"/></linearGradient></defs>${RECT}</svg>`,
    );
    expect(r.warnings.join('\n')).toMatch(/gradientTransform/);
  });

  it('reads percentage offsets, stop-opacity and coordinates', () => {
    const paint = gradientOf(
      `<svg xmlns="http://www.w3.org/2000/svg"><defs>`
      + `<linearGradient id="g" x1="0%" x2="100%">`
      + `<stop offset="50%" stop-color="#ff0000" stop-opacity="50%"/>`
      + `</linearGradient></defs>${RECT}</svg>`,
    );
    expect(paint.to).toEqual({ x: 1, y: 0 });
    expect(paint.stops).toEqual([{ offset: 0.5, color: '#ff000080' }]);
  });

  it('still warns about a <defs> child it cannot model', () => {
    const r = parseSvg(
      `<svg xmlns="http://www.w3.org/2000/svg"><defs><clipPath id="c"/></defs></svg>`,
    );
    expect(r.warnings).toContain('unsupported <defs> child: <clipPath>');
  });
});

describe('gradient serialization', () => {
  const conicRect: SvgNode[] = [{
    kind: 'path',
    path: { kind: 'rect', x: 0, y: 0, width: 100, height: 50 },
    fill: {
      kind: 'gradient',
      paint: {
        fill: 'conic-gradient',
        center: { x: 0.5, y: 0.5 },
        angle: 0,
        stops: [{ offset: 0, color: '#ff0000' }, { offset: 1, color: '#0000ff' }],
        units: 'bounds',
      },
    },
  }];

  it('warns rather than silently emitting a dangling url(#…) for a conic gradient', () => {
    const warnings: string[] = [];
    const svg = serializeSvg(conicRect, { onWarn: (m) => warnings.push(m) });
    expect(warnings.join(' ')).toContain('conic-gradient');
    expect(svg).not.toContain('<conicGradient');
  });
});
