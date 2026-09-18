import { describe, it, expect } from 'vitest';
import { parseSvg } from './parse';
import { serializeSvg } from './serialize';
import { seedMeshPatch } from '@weasel-js/core';
import type { SvgNode } from './types';

const MESH = seedMeshPatch('#e2574cff');

function meshSquare(paint: unknown = MESH): SvgNode[] {
  return [{
    kind: 'path',
    path: { kind: 'rect', x: 0, y: 0, width: 10, height: 10 },
    fill: { kind: 'gradient', paint },
  } as unknown as SvgNode];
}

function paintOf(svg: string): Record<string, unknown> {
  const nodes = parseSvg(svg).nodes as unknown as { fill?: { paint?: Record<string, unknown> } }[];
  const paint = nodes[0].fill?.paint;
  if (!paint) throw new Error('no paint parsed');
  return paint;
}

describe('mesh gradients in SVG', () => {
  it('writes the kind own def, with the namespace declared', () => {
    const warnings: string[] = [];
    const svg = serializeSvg(meshSquare(), { onWarn: (m) => warnings.push(m) });
    expect(warnings).toEqual([]);
    expect(svg).toContain('xmlns:wzl="urn:weasel-js:svg"');
    expect(svg).toContain('<wzl:meshGradient id="grad0"');
    expect(svg).toContain('<wzl:patch points="');
  });

  it('carries a paint fallback, so a foreign viewer paints flat', () => {
    expect(serializeSvg(meshSquare())).toContain('fill="url(#grad0) #e2574c"');
  });

  it('round-trips every point and color', () => {
    const back = paintOf(serializeSvg(meshSquare())) as unknown as typeof MESH;
    expect(back.fill).toBe('mesh-gradient');
    expect(back.units).toBe('bounds');
    expect(back.patches).toHaveLength(1);
    expect(back.patches[0].colors).toEqual(MESH.patches[0].colors);
    back.patches[0].points.forEach((p, i) => {
      expect(p.x).toBeCloseTo(MESH.patches[0].points[i].x, 4);
      expect(p.y).toBeCloseTo(MESH.patches[0].points[i].y, 4);
    });
  });

  it('round-trips the blend space', () => {
    const svg = serializeSvg(meshSquare({ ...MESH, interpolate: 'oklch' }));
    expect(svg).toContain('interpolate="oklch"');
    expect(paintOf(svg).interpolate).toBe('oklch');
  });

  it('drops a patch whose point count is not a patch, and says so', () => {
    const svg = serializeSvg(meshSquare()).replace(/points="[^"]+"/, 'points="0,0 1,1"');
    expect(parseSvg(svg).warnings.join(' ')).toContain('wzl:patch');
  });

  it('takes the fallback color when every patch is unreadable', () => {
    const svg = serializeSvg(meshSquare()).replace(/points="[^"]+"/, 'points="0,0"');
    // Nothing left to model, so the reference resolves to nothing and the
    // fallback color beside it is what paints.
    const node = parseSvg(svg).nodes[0] as { fill: unknown };
    expect(node.fill).toEqual({ kind: 'solid', color: '#e2574c' });
  });
});
