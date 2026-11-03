import type { Mat4 } from '@weasel-js/geom/3d';
import { LINE_FLOATS } from './pack';
import { LINE_FS, LINE_VS } from './pass.glsl';

/** Options for {@link LinePass.draw}. */
export interface LineDrawOptions {
  /** Hide the parts of a line behind what the bound depth buffer holds. Default true. */
  depthTest?: boolean;
}

/**
 * Lines drawn into a WebGL2 context the host owns. The kernel hosts a renderer
 * rather than owning one; this is a pass that renderer calls, between its own.
 */
export interface LinePass {
  /**
   * Draw `vertices`, as {@link packLines} lays them out, into the bound
   * framebuffer under the host's `gl.viewport`. `viewProjection` takes world
   * points to clip space; `size` is that viewport in CSS pixels, the unit a
   * line's width is given in. Depth is tested, not written, and blending is
   * straight alpha. The capabilities, depth mask, blend function, program,
   * vertex array and array buffer it changes are put back as it found them.
   */
  draw(
    vertices: Float32Array,
    viewProjection: Mat4,
    size: { width: number; height: number },
    options?: LineDrawOptions,
  ): void;
  dispose(): void;
}

/** `[size, offset]` per attribute location, in floats, in `LINE_FLOATS` order. */
const ATTRIBUTES: readonly (readonly [number, number])[] = [
  [3, 0], [3, 3], [3, 6], [2, 9], [3, 11], [4, 14], [3, 18], [4, 21], [4, 25],
];

function compile(gl: WebGL2RenderingContext, type: number, source: string): WebGLShader {
  const shader = gl.createShader(type)!;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS) && !gl.isContextLost()) {
    const log = gl.getShaderInfoLog(shader);
    gl.deleteShader(shader);
    throw new Error(`kernel3d line pass: shader failed to compile: ${log}`);
  }
  return shader;
}

function link(gl: WebGL2RenderingContext): WebGLProgram {
  const program = gl.createProgram()!;
  const vs = compile(gl, gl.VERTEX_SHADER, LINE_VS);
  const fs = compile(gl, gl.FRAGMENT_SHADER, LINE_FS);
  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  gl.linkProgram(program);
  gl.deleteShader(vs);
  gl.deleteShader(fs);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS) && !gl.isContextLost()) {
    const log = gl.getProgramInfoLog(program);
    gl.deleteProgram(program);
    throw new Error(`kernel3d line pass: program failed to link: ${log}`);
  }
  return program;
}

/** A {@link LinePass} on `gl`: one program, one vertex array, one buffer refilled each draw. */
export function createLinePass(gl: WebGL2RenderingContext): LinePass {
  const program = link(gl);
  const viewProjection = gl.getUniformLocation(program, 'u_viewProjection');
  const halfViewport = gl.getUniformLocation(program, 'u_halfViewport');
  const buffer = gl.createBuffer();
  const vao = gl.createVertexArray();

  const prevVao = gl.getParameter(gl.VERTEX_ARRAY_BINDING) as WebGLVertexArrayObject | null;
  const prevBuffer = gl.getParameter(gl.ARRAY_BUFFER_BINDING) as WebGLBuffer | null;
  gl.bindVertexArray(vao);
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  ATTRIBUTES.forEach(([size, offset], loc) => {
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, size, gl.FLOAT, false, LINE_FLOATS * 4, offset * 4);
  });
  gl.bindVertexArray(prevVao);
  gl.bindBuffer(gl.ARRAY_BUFFER, prevBuffer);

  const matrix = new Float32Array(16);

  return {
    draw(vertices, vp, size, options = {}) {
      if (vertices.length === 0) return;
      const was = {
        program: gl.getParameter(gl.CURRENT_PROGRAM) as WebGLProgram | null,
        vao: gl.getParameter(gl.VERTEX_ARRAY_BINDING) as WebGLVertexArrayObject | null,
        buffer: gl.getParameter(gl.ARRAY_BUFFER_BINDING) as WebGLBuffer | null,
        blend: gl.isEnabled(gl.BLEND),
        depth: gl.isEnabled(gl.DEPTH_TEST),
        cull: gl.isEnabled(gl.CULL_FACE),
        depthMask: gl.getParameter(gl.DEPTH_WRITEMASK) as boolean,
        blendFunc: [gl.BLEND_SRC_RGB, gl.BLEND_DST_RGB, gl.BLEND_SRC_ALPHA, gl.BLEND_DST_ALPHA]
          .map((p) => gl.getParameter(p) as number) as [number, number, number, number],
      };

      gl.useProgram(program);
      matrix.set(vp);
      gl.uniformMatrix4fv(viewProjection, false, matrix);
      gl.uniform2f(halfViewport, Math.max(1, size.width) / 2, Math.max(1, size.height) / 2);
      gl.enable(gl.BLEND);
      gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
      // A segment's quad winds whichever way its direction on screen turns it.
      gl.disable(gl.CULL_FACE);
      if (options.depthTest ?? true) gl.enable(gl.DEPTH_TEST);
      else gl.disable(gl.DEPTH_TEST);
      gl.depthMask(false);
      gl.bindVertexArray(vao);
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.DYNAMIC_DRAW);
      gl.drawArrays(gl.TRIANGLES, 0, vertices.length / LINE_FLOATS);

      gl.useProgram(was.program);
      gl.bindVertexArray(was.vao);
      gl.bindBuffer(gl.ARRAY_BUFFER, was.buffer);
      const set = (cap: number, on: boolean) => (on ? gl.enable(cap) : gl.disable(cap));
      set(gl.BLEND, was.blend);
      set(gl.DEPTH_TEST, was.depth);
      set(gl.CULL_FACE, was.cull);
      gl.depthMask(was.depthMask);
      gl.blendFuncSeparate(...was.blendFunc);
    },

    dispose() {
      gl.deleteVertexArray(vao);
      gl.deleteBuffer(buffer);
      gl.deleteProgram(program);
    },
  };
}
