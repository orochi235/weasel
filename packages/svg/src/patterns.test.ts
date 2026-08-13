import { describe, it, expect } from 'vitest';
import { serializeSvg } from './serialize';
import { parseSvg } from './parse';
import type { SvgNode } from './types';
import type { FillStyle, TilePatternSpec } from '@weasel-js/core';

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
