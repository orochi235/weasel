import { describe, it, expect } from 'vitest';
import { PathBuilder, worldCoords, type PolygonPath } from '@weasel-js/geom';
import { parseSvg, serializeSvg, type SvgNode } from './index';

const FAR = 262_144;

const pathOf = (svg: string): PolygonPath => {
  const node = parseSvg(svg).nodes[0] as SvgNode & { path: PolygonPath };
  return node.path;
};

describe('SVG far from the origin', () => {
  it('imports path data reaching past the threshold measured from an origin', () => {
    const p = pathOf(`<svg xmlns="http://www.w3.org/2000/svg"><path d="M262144.3 1 L262145.3 1 L262145.8 2 Z"/></svg>`);
    expect(p.origin).toBeDefined();
    // Without an origin, float32 rounds FAR + 0.3 to FAR + 0.3125.
    expect(worldCoords(p)[0]).toBeCloseTo(FAR + 0.3, 5);
  });

  it('imports a basic shape past the threshold measured from an origin', () => {
    const p = pathOf(`<svg xmlns="http://www.w3.org/2000/svg"><circle cx="262144.3" cy="0.3" r="0.2"/></svg>`);
    expect(p.origin).toBeDefined();
    expect(Math.min(...worldCoords(p).filter((_, i) => i % 2 === 0))).toBeCloseTo(FAR + 0.1, 5);
  });

  it('imports a document near 0 without origins', () => {
    expect(pathOf(`<svg xmlns="http://www.w3.org/2000/svg"><path d="M1 1 L2 1 L2.5 2 Z"/></svg>`).origin).toBeUndefined();
  });

  it('exports a path with an origin in its own space', () => {
    const path = new PathBuilder().setOrigin(FAR, 0)
      .moveTo(FAR + 0.3, 1).lineTo(FAR + 1.3, 1).lineTo(FAR + 1.8, 2).close().build();
    const svg = serializeSvg([{ kind: 'path', path, fill: { kind: 'solid', color: '#000000' } } as SvgNode]);
    expect(svg).toContain('d="M262144.3 1L262145.3 1L262145.8 2Z"');
  });
});
