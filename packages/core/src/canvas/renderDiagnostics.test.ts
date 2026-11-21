import { describe, expect, it } from 'vitest';
import { pathFromD } from '@weasel-js/geom';
import { registerProgram, type DrawCommand } from '@weasel-js/renderer';
import { reportCommandLosses, type RenderDiagnostic } from './renderDiagnostics';

const INK = { kind: 'solid', color: '#000' } as const;

describe('reportCommandLosses', () => {
  it('reports each marker key a stroke names that nothing registered, once', () => {
    const path = pathFromD('M0 0 L10 0');
    const commands: DrawCommand[] = [
      { kind: 'path', path, stroke: { paint: INK, width: 1, markerStart: 'arrow', markerEnd: 'arow' } },
      { kind: 'group', children: [{ kind: 'path', path, stroke: { paint: INK, width: 1, markerMid: { key: 'arow' } } }] } as DrawCommand,
    ];
    const found: RenderDiagnostic[] = [];
    reportCommandLosses(commands, [], (d) => found.push(d));
    expect(found.filter((d) => d.kind === 'marker')).toEqual([
      expect.objectContaining({ kind: 'marker', subject: 'arow' }),
    ]);
  });

  it('reports a group effect whose program has no GLSL source', () => {
    const blur = registerProgram('diagnostics-wgsl-only-blur', { wgsl: { frag: 'fn fragment(in: Varyings) -> vec4f { return vec4f(0.0); }' } });
    const commands = [{ kind: 'group', effects: [{ program: blur }], children: [] }] as unknown as DrawCommand[];
    const found: RenderDiagnostic[] = [];
    reportCommandLosses(commands, [], (d) => found.push(d));
    expect(found).toEqual([expect.objectContaining({ kind: 'shader', subject: blur.id })]);
  });
});
