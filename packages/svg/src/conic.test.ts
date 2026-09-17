import { describe, it, expect } from 'vitest';
import { parseSvg } from './parse';
import { serializeSvg } from './serialize';
import type { SvgNode } from './types';

const CONIC = {
  fill: 'conic-gradient' as const,
  center: { x: 0.5, y: 0.5 },
  angle: 0.25,
  stops: [{ offset: 0, color: '#ff0000' }, { offset: 1, color: '#0000ff' }],
  units: 'bounds' as const,
};

function conicSquare(): SvgNode[] {
  return [{
    kind: 'path',
    path: { kind: 'rect', x: 0, y: 0, width: 10, height: 10 },
    fill: { kind: 'gradient', paint: CONIC },
  } as unknown as SvgNode];
}

describe('conic gradient serialization', () => {
  it('writes a private-namespace def rather than omitting the paint', () => {
    const warnings: string[] = [];
    const svg = serializeSvg(conicSquare(), { onWarn: (m) => warnings.push(m) });
    expect(warnings).toEqual([]);
    expect(svg).toContain('xmlns:wzl="urn:weasel-js:svg"');
    expect(svg).toContain('<wzl:conicGradient id="grad0"');
    expect(svg).toContain('cx="0.5" cy="0.5" angle="0.25"');
    expect(svg).toContain('gradientUnits="objectBoundingBox"');
    expect(svg).toContain('<stop offset="0" stop-color="#ff0000"/>');
  });

  it('carries a paint fallback color, so a foreign viewer paints flat', () => {
    const svg = serializeSvg(conicSquare());
    expect(svg).toContain('fill="url(#grad0) #ff0000"');
  });

  it('does not declare the namespace when no paint needs it', () => {
    const svg = serializeSvg([{
      kind: 'path',
      path: { kind: 'rect', x: 0, y: 0, width: 10, height: 10 },
      fill: { kind: 'solid', color: '#123456' },
    } as unknown as SvgNode]);
    expect(svg).not.toContain('urn:weasel-js:svg');
  });

  it('round-trips through parse with no warnings', () => {
    const svg = serializeSvg(conicSquare());
    const r = parseSvg(svg);
    expect(r.warnings).toEqual([]);
    const paint = (r.nodes[0] as { fill: { kind: string; paint: typeof CONIC } }).fill;
    expect(paint.kind).toBe('gradient');
    expect(paint.paint).toEqual(CONIC);
  });

  it('reads world units back', () => {
    const svg = serializeSvg([{
      kind: 'path',
      path: { kind: 'rect', x: 0, y: 0, width: 10, height: 10 },
      fill: { kind: 'gradient', paint: { ...CONIC, units: 'world', center: { x: 4, y: 6 } } },
    } as unknown as SvgNode]);
    const r = parseSvg(svg);
    const paint = (r.nodes[0] as { fill: { paint: typeof CONIC } }).fill.paint;
    expect(paint.units).toBe('world');
    expect(paint.center).toEqual({ x: 4, y: 6 });
  });
});

describe('unresolvable paint references', () => {
  it('takes the fallback color instead of dropping the fill', () => {
    const r = parseSvg(
      '<svg xmlns="http://www.w3.org/2000/svg">'
      + '<rect x="0" y="0" width="10" height="10" fill="url(#mesh1) #c04a3f"/></svg>',
    );
    expect(r.warnings).toEqual([]);
    expect((r.nodes[0] as { fill: unknown }).fill).toEqual({ kind: 'solid', color: '#c04a3f' });
  });

  it('still warns when a reference resolves to nothing and carries no fallback', () => {
    const r = parseSvg(
      '<svg xmlns="http://www.w3.org/2000/svg">'
      + '<rect x="0" y="0" width="10" height="10" fill="url(#mesh1)"/></svg>',
    );
    expect(r.warnings.join(' ')).toContain('#mesh1');
  });
});
