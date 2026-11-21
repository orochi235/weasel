import { describe, it, expect } from 'vitest';
import { viewToMat3, type RectPath } from '@weasel-js/geom';
import { tessellate } from '@weasel-js/geom/tessellate';
import { createGLRecorder, glProgramHandle, glUniformLocation } from '../testing/glRecorder';
import { WeaselRenderer } from '../WeaselRenderer';
import type { DrawCommand } from '../DrawCommand';
import type { ShaderProgram } from '../shaders/ShaderProgram';
import { rendererParts } from '../rendererParts';

/** A rect far enough from 0 that its fill mesh is measured from an origin. */
const FAR: RectPath = { kind: 'rect', x: 20_000, y: 0, width: 20, height: 20 };
/** Puts FAR's left edge at screen x = 100. */
const VIEW = viewToMat3({ x: FAR.x - 100, y: 0, scale: { x: 1, y: 1 } });

function frame(cmd: DrawCommand) {
  const rec = createGLRecorder();
  const r = new WeaselRenderer({ gl: rec.gl, width: 800, height: 600, dpr: 1 });
  // No hulls and no CPU cuts: the clip and the aligned stroke both go to the stencil.
  const variants = rendererParts(r).batchVariants!;
  Object.defineProperty(variants, 'hulls', { value: false });
  Object.defineProperty(variants, 'cuts', { value: false });
  rec.reset();
  r.render([{ kind: 'group', transform: VIEW, children: [cmd] }], VIEW);
  return { rec, r };
}

/** Where each draw under `prog` puts a local point, from the model and origin it drew with. */
function placements(rec: ReturnType<typeof createGLRecorder>, prog: ShaderProgram) {
  const handle = glProgramHandle(prog);
  const modelAt = glUniformLocation(prog, 'u_model');
  const originAt = glUniformLocation(prog, 'u_origin');
  let bound: unknown = null;
  let model: Float32Array | null = null;
  let ox = 0, oy = 0;
  const out: ((x: number, y: number) => number)[] = [];
  for (const c of rec.calls) {
    if (c.name === 'useProgram') bound = c.args[0];
    if (c.name === 'uniformMatrix3fv' && c.args[0] === modelAt) model = Float32Array.from(c.args[2] as Float32Array);
    if (c.name === 'uniform2f' && c.args[0] === originAt) [ox, oy] = [c.args[1] as number, c.args[2] as number];
    if (c.name === 'drawElements' && bound === handle && model) {
      const [m, x0, y0] = [model, ox, oy];
      out.push((x, y) => m[0] * (x - x0) + m[3] * (y - y0) + m[6]);
    }
  }
  return out;
}

const fillLeft = () => tessellate(FAR).vertices[0];

describe('a rect whose fill mesh carries an origin', () => {
  it('rasterizes a stencil clip where the rect is', () => {
    const { rec, r } = frame({
      kind: 'group',
      clip: FAR,
      // A draw of its own inside the clip gives the clip its stencil bit.
      children: [{ kind: 'path', path: FAR, stroke: { paint: { kind: 'solid', color: '#00f' }, width: 30, align: 'inner' } }],
    } as DrawCommand);
    const [push] = placements(rec, r._pathFill());
    expect(push(fillLeft(), 0)).toBeCloseTo(100, 3);
  });
});
