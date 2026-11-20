import { afterEach, describe, expect, it, vi } from 'vitest';
import { createGLRecorder } from '../testing/glRecorder';
import { WeaselRenderer } from '../WeaselRenderer';
import type { DrawCommand } from '../DrawCommand';
import { registerPaintDrawKind } from '../paintKinds';
import { VERT_SRC, FRAG_SRC } from '../shaders/pathFill';
import { OWN_DRAW_WGSL } from '../gpu/webgpu/wgsl/ownDrawPaint';

/** Red lifted by a quarter: a bias nothing else in the frame uploads. */
const LIFT = [1, 0, 0, 0, 0.25, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0];

const UNMAPPED_FRAG = `#version 300 es
precision mediump float;
out vec4 fragColor;
void main() { fragColor = vec4(1.0); }
`;

function kind(id: string, frag: string): () => void {
  return registerPaintDrawKind({
    id,
    programs: { [id]: { glsl: { vert: VERT_SRC, frag }, wgsl: { frag: OWN_DRAW_WGSL } } },
    bind: () => ({ program: id }),
  });
}

function renderUnderLift(id: string) {
  const rec = createGLRecorder();
  const r = new WeaselRenderer({ gl: rec.gl, width: 100, height: 100, dpr: 1 });
  rec.reset();
  const rect = {
    kind: 'path', path: { kind: 'rect', x: 0, y: 0, width: 10, height: 10 }, fill: { paint: { kind: id } },
  } as unknown as DrawCommand;
  r.render([{ kind: 'group', colorMatrix: LIFT, children: [rect] } as DrawCommand]);
  return rec.calls;
}

describe('a registered paint kind under a group color matrix', () => {
  afterEach(() => vi.restoreAllMocks());

  it('gets the matrix where its program declares u_colorMatrix', () => {
    const drop = kind('test/mapped-kind', FRAG_SRC);
    const calls = renderUnderLift('test/mapped-kind');
    drop();
    const bias = calls.filter((c) => c.name === 'uniform4f').map((c) => c.args.slice(1));
    expect(bias).toContainEqual([0.25, 0, 0, 0]);
  });

  it('warns once where its program declares none', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const drop = kind('test/unmapped-kind', UNMAPPED_FRAG);
    renderUnderLift('test/unmapped-kind');
    renderUnderLift('test/unmapped-kind');
    drop();
    const about = warn.mock.calls.filter((c) => String(c[0]).includes('u_colorMatrix'));
    expect(about).toHaveLength(1);
    expect(about[0]![0]).toContain('"test/unmapped-kind"');
  });
});
