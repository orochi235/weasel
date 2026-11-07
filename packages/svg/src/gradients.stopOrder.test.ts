import { describe, expect, it } from 'vitest';
import { parseSvg } from './parse';

const stopsOf = (stops: string): unknown => {
  const r = parseSvg(
    `<svg xmlns="http://www.w3.org/2000/svg"><linearGradient id="g">${stops}</linearGradient>`
    + `<rect x="0" y="0" width="10" height="10" fill="url(#g)"/></svg>`,
  );
  return (r.nodes[0] as { fill: { paint: { stops: unknown[] } } }).fill.paint.stops;
};

describe('gradient stop offsets, as SVG resolves them', () => {
  it('raises an offset below an earlier one to that one, keeping document order', () => {
    expect(stopsOf('<stop offset="0.5" stop-color="#ff0000"/><stop offset="0.2" stop-color="#0000ff"/>')).toEqual([
      { offset: 0.5, color: '#ff0000' },
      { offset: 0.5, color: '#0000ff' },
    ]);
  });

  it('clamps an offset to 0..1', () => {
    expect(stopsOf('<stop offset="-20%" stop-color="#ff0000"/><stop offset="1.5" stop-color="#0000ff"/>')).toEqual([
      { offset: 0, color: '#ff0000' },
      { offset: 1, color: '#0000ff' },
    ]);
  });
});
