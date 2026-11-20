/**
 * Log depth in a real depth buffer: two surfaces 1 m apart, 1e6 m from a camera
 * with near 0.1 and far 2e6. A host mesh shader writing `LOG_DEPTH_GLSL`'s
 * depth keeps the nearer in front; standard depth gives both one value. The
 * line pass, told the camera's log depth, tests against that buffer.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { sub, type Vec3 } from '@weasel-js/geom/3d';
import {
  LOG_DEPTH_GLSL, cameraFrame, createCamera, createLinePass, logDepthUniform, packLines, projectPoint,
  type Camera3d, type CameraFrame, type LinePass,
} from '@weasel-js/kernel3d';

const W = 160;
const H = 120;
const D = 1e6;
/** Half a surface's side: 29 px on screen at 1e6 m. */
const HALF = 2e5;
const RED: [number, number, number, number] = [1, 0, 0, 1];
const BLUE: [number, number, number, number] = [0, 0, 1, 1];
const GREEN: [number, number, number, number] = [0, 1, 0, 1];

const VS = `#version 300 es
layout(location = 0) in vec3 a_position;
uniform mat4 u_viewProjection;
void main() { gl_Position = u_viewProjection * vec4(a_position, 1.0); }`;

const fs = (log: boolean) => `#version 300 es
precision highp float;
uniform vec4 u_color;
uniform vec3 u_logDepth;
out vec4 fragColor;
${LOG_DEPTH_GLSL}
void main() {
  fragColor = u_color;
  ${log ? 'gl_FragDepth = weaselLogDepth(u_logDepth);' : ''}
}`;

const passes: LinePass[] = [];
afterEach(() => {
  for (const p of passes) p.dispose();
  passes.length = 0;
});

const cameraWith = (depth: 'standard' | 'log'): Camera3d =>
  createCamera({ target: { x: 0, y: 0, z: 0 }, distance: D, near: 0.1, far: 2e6, depth });

function program(gl: WebGL2RenderingContext, log: boolean): WebGLProgram {
  const p = gl.createProgram()!;
  for (const [type, src] of [[gl.VERTEX_SHADER, VS], [gl.FRAGMENT_SHADER, fs(log)]] as const) {
    const s = gl.createShader(type)!;
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) ?? 'compile');
    gl.attachShader(p, s);
  }
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p) ?? 'link');
  return p;
}

/** A host's mesh draw: a square facing the camera at height `z`, positions relative to the frame's origin. */
function square(gl: WebGL2RenderingContext, prog: WebGLProgram, frame: CameraFrame, z: number, color: readonly number[]) {
  const corners: Vec3[] = [[-1, -1], [1, -1], [1, 1], [-1, -1], [1, 1], [-1, 1]]
    .map(([x, y]) => sub({ x: x * HALF, y: y * HALF, z }, frame.origin));
  const buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(corners.flatMap((p) => [p.x, p.y, p.z])), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);
  gl.useProgram(prog);
  gl.uniformMatrix4fv(gl.getUniformLocation(prog, 'u_viewProjection'), false, new Float32Array(frame.viewProjection));
  gl.uniform4fv(gl.getUniformLocation(prog, 'u_color'), color);
  if (frame.logDepth) gl.uniform3fv(gl.getUniformLocation(prog, 'u_logDepth'), logDepthUniform(frame.logDepth));
  gl.drawArrays(gl.TRIANGLES, 0, 6);
  gl.deleteBuffer(buffer);
}

interface Drawn { px: Uint8Array; camera: Camera3d }

/** The far surface first, then the near one 1 m in front of it, then lines through the pass at heights `lines`. */
function scene(depth: 'standard' | 'log', lines: { z: number; y: number }[] = [], tellPass = true): Drawn {
  const camera = cameraWith(depth);
  const frame = cameraFrame(camera, W / H);
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const gl = canvas.getContext('webgl2', { antialias: false, preserveDrawingBuffer: true, stencil: true })!;
  gl.viewport(0, 0, W, H);
  gl.clearColor(0, 0, 0, 0);
  gl.clearDepth(1);
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
  gl.enable(gl.DEPTH_TEST);
  gl.depthFunc(gl.LESS);
  gl.depthMask(true);
  const prog = program(gl, depth === 'log');
  square(gl, prog, frame, -1, BLUE);
  square(gl, prog, frame, 0, RED);
  if (lines.length) {
    const pass = createLinePass(gl);
    passes.push(pass);
    const packed = packLines(lines.map(({ z, y }) => ({
      runs: [{ points: [{ x: -HALF / 2, y, z }, { x: HALF / 2, y, z }] }], color: GREEN, width: 4, head: null,
    })), frame.origin);
    pass.draw(packed, frame.viewProjection, { width: W, height: H }, { logDepth: tellPass ? frame.logDepth : null });
  }
  const px = new Uint8Array(W * H * 4);
  gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, px);
  return { px, camera };
}

/** The color under the CSS point the world point `p` projects to. */
function colorAt({ px, camera }: Drawn, p: Vec3): [number, number, number] {
  const s = projectPoint(p, { camera, width: W, height: H })!;
  const i = ((H - 1 - Math.floor(s.y)) * W + Math.floor(s.x)) * 4;
  return [px[i], px[i + 1], px[i + 2]];
}

/** How many pixels of the block well inside both surfaces are red, of how many. */
function redInside(d: Drawn): { red: number; of: number } {
  let red = 0;
  let of = 0;
  for (let y = H / 2 - 20; y < H / 2 + 20; y++) {
    for (let x = W / 2 - 20; x < W / 2 + 20; x++) {
      const i = (y * W + x) * 4;
      of++;
      if (d.px[i] === 255 && d.px[i + 2] === 0) red++;
    }
  }
  return { red, of };
}

describe('log depth', () => {
  it('keeps the nearer of two surfaces 1 m apart at 1e6 m in front', () => {
    const log = redInside(scene('log'));
    expect(log.red).toBe(log.of);
  });

  it('is needed: standard depth lets the farther surface through', () => {
    const standard = redInside(scene('standard'));
    expect(standard.red).toBeLessThan(standard.of);
  });

  it('hides a line behind a log-depth surface and shows one in front, when the pass is told', () => {
    const front = { z: 5, y: HALF / 3 };
    const back = { z: -5, y: -HALF / 3 };
    const told = scene('log', [front, back]);
    expect(colorAt(told, { x: 0, ...front })).toEqual([0, 255, 0]);
    expect(colorAt(told, { x: 0, ...back })).toEqual([255, 0, 0]);
    // Testing standard depth against a log buffer, the line in front is lost behind the surface.
    const untold = scene('log', [front], false);
    expect(colorAt(untold, { x: 0, ...front })).toEqual([255, 0, 0]);
  });
});
