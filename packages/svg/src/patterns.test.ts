import { describe, it, expect } from 'vitest';
import { serializeSvg } from './serialize';
import { parseSvg } from './parse';
import type { SvgNode } from './types';
import { composePatternTransform, type FillStyle, type TilePatternSpec } from '@weasel-js/core';
import { trimNumber } from './transform';

function patternedRect(pattern: FillStyle): SvgNode[] {
  return [{
    kind: 'path',
    path: { kind: 'rect', x: 0, y: 0, width: 100, height: 50 },
    fill: { kind: 'gradient', paint: pattern },
  }];
}

function firstFill(nodes: SvgNode[]): FillStyle | undefined {
  const n = nodes[0];
  if (n?.kind !== 'path') return undefined;
  return n.fill.kind === 'gradient' ? n.fill.paint : undefined;
}

const TILES: TilePatternSpec[] = [
  { tile: 'hatch', color: '#0fb5a8' },
  { tile: 'crosshatch', color: '#c84edb', size: 8, lineWidth: 1.5 },
  { tile: 'dots', color: '#f4c43c', size: 10, radius: 2 },
  { tile: 'chunks', color: '#e2574c', bg: '#1d2733', size: 24, seed: 7 },
];

describe('pattern serialization', () => {
  it.each(TILES)('round-trips the $tile tile', (spec) => {
    const svg = serializeSvg(patternedRect({ fill: 'pattern', pattern: spec }));
    expect(svg).toContain('<pattern ');
    expect(svg).toContain('patternUnits="userSpaceOnUse"');

    const back = firstFill(parseSvg(svg).nodes);
    expect(back).toBeDefined();
    expect(back!.fill).toBe('pattern');
    expect((back as { pattern: TilePatternSpec }).pattern).toEqual(spec);
  });

  it('emits the tile as real geometry, not just the spec attribute', () => {
    const svg = serializeSvg(patternedRect({ fill: 'pattern', pattern: TILES[0] }));
    // A viewer with no weasel knowledge still renders hatching.
    expect(svg).toContain('<line ');
    expect(svg).toContain('stroke="#0fb5a8"');
  });

  it('emits dots as a circle and chunks over a background rect', () => {
    const dots = serializeSvg(patternedRect({ fill: 'pattern', pattern: TILES[2] }));
    expect(dots).toContain('<circle ');

    const chunks = serializeSvg(patternedRect({ fill: 'pattern', pattern: TILES[3] }));
    expect(chunks).toContain('<rect ');
    expect(chunks).toContain('fill="#1d2733"');
    expect(chunks).toContain('<ellipse ');
  });

  it('carries the tile origin through x/y', () => {
    const paint: FillStyle = {
      fill: 'pattern', pattern: TILES[0], origin: { x: 12, y: -4 },
    };
    const svg = serializeSvg(patternedRect(paint));
    expect(svg).toContain('x="12"');
    expect(svg).toContain('y="-4"');

    const back = firstFill(parseSvg(svg).nodes) as Extract<FillStyle, { fill: 'pattern' }>;
    expect(back.origin).toEqual({ x: 12, y: -4 });
  });

  it('writes a transform as patternTransform, folding the origin into it', () => {
    const transform = composePatternTransform({ rotation: Math.PI / 6, scaleX: 2, skewX: 0.25 });
    const paint: FillStyle = {
      fill: 'pattern', pattern: TILES[0], origin: { x: 12, y: -4 }, transform,
    };
    const svg = serializeSvg(patternedRect(paint));
    const [a, b, c, d] = transform.map((n) => trimNumber(n));
    expect(svg).toContain(`patternTransform="matrix(${a} ${b} ${c} ${d} 12 -4)"`);
    expect(svg).not.toMatch(/<pattern [^>]*\sx="/);

    const back = firstFill(parseSvg(svg).nodes) as Extract<FillStyle, { fill: 'pattern' }>;
    expect(back.origin!.x).toBeCloseTo(12, 5);
    expect(back.origin!.y).toBeCloseTo(-4, 5);
    back.transform!.forEach((v, i) => expect(v).toBeCloseTo(transform[i], 5));
  });

  it('omits patternTransform for an identity transform', () => {
    const svg = serializeSvg(patternedRect({
      fill: 'pattern', pattern: TILES[0], transform: [1, 0, 0, 1],
    }));
    expect(svg).not.toContain('patternTransform');
  });

  it('reads a hand-written patternTransform list and x/y into origin and transform', () => {
    const spec = JSON.stringify(TILES[0]).replace(/"/g, '&quot;');
    const doc = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><defs>'
      + '<pattern id="p" patternUnits="userSpaceOnUse" width="5" height="5" x="2" y="0" '
      + `patternTransform="translate(10 20) rotate(90) skewX(45)" data-weasel-tile="${spec}"/>`
      + '</defs><rect x="0" y="0" width="100" height="100" fill="url(#p)"/></svg>';
    const back = firstFill(parseSvg(doc).nodes) as Extract<FillStyle, { fill: 'pattern' }>;
    // M = T(10, 20) · R(90°) · K(45°); the tile starts at M · (2, 0) = (10, 22).
    expect(back.origin!.x).toBeCloseTo(10, 5);
    expect(back.origin!.y).toBeCloseTo(22, 5);
    [0, 1, -1, 1].forEach((v, i) => expect(back.transform![i]).toBeCloseTo(v, 5));
  });

  it('warns and drops a pattern carrying a TextureHandle', () => {
    const warnings: string[] = [];
    const svg = serializeSvg(
      patternedRect({ fill: 'pattern', pattern: { id: 'tex_1' } }),
      { onWarn: (m) => warnings.push(m) },
    );
    expect(svg).not.toContain('<pattern ');
    expect(warnings.join(' ')).toContain('TextureHandle');
  });

  it('drops a hand-authored pattern with a warning rather than guessing', () => {
    const foreign = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10">'
      + '<defs><pattern id="p" width="4" height="4"><circle cx="2" cy="2" r="1"/></pattern></defs>'
      + '<rect x="0" y="0" width="10" height="10" fill="url(#p)"/>'
      + '</svg>';
    const { warnings } = parseSvg(foreign);
    expect(warnings.join(' ')).toContain('data-weasel-tile');
  });

  it('does not warn about <pattern> as an unsupported defs child', () => {
    const svg = serializeSvg(patternedRect({ fill: 'pattern', pattern: TILES[0] }));
    const { warnings } = parseSvg(svg);
    expect(warnings.join(' ')).not.toContain('unsupported <defs> child');
  });
});
