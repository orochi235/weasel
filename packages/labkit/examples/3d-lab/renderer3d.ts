/**
 * A small WebGL2 renderer: one program, flat-lit solids, a ground grid, and a
 * scissored draw so it can share one context with whatever else the lab's
 * surface is hosting.
 *
 * Deliberately naive. Batching, materials and antialiasing are not what the lab
 * measures, and they would make what it does measure harder to read.
 */

import { cameraViewProjection, type Camera3d } from './camera3d';
import { compose, identity, multiply, type Mat4 } from './math3d';
import type { Pose3, SolidKind } from './scene3d';

export interface SolidDraw {
  pose: Pose3;
  kind: SolidKind;
  color: string;
  selected: boolean;
}

export interface DeviceRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** A selection outline, in CSS pixels relative to the tile's top-left. */
export interface ChromeBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Renderer3d {
  draw(
    solids: readonly SolidDraw[],
    camera: Camera3d,
    rect: DeviceRect,
    chrome: readonly ChromeBox[],
    cssSize: { width: number; height: number },
  ): void;
  clearAll(width: number, height: number): void;
  dispose(): void;
}

const VERTEX_SRC = `#version 300 es
precision highp float;
layout(location = 0) in vec3 a_position;
layout(location = 1) in vec3 a_normal;
uniform mat4 u_mvp;
uniform mat4 u_model;
out vec3 v_normal;
void main() {
  v_normal = mat3(u_model) * a_normal;
  gl_Position = u_mvp * vec4(a_position, 1.0);
}`;

const FRAGMENT_SRC = `#version 300 es
precision highp float;
in vec3 v_normal;
uniform vec3 u_color;
uniform float u_selected;
out vec4 outColor;
void main() {
  vec3 n = normalize(v_normal);
  vec3 lightDir = normalize(vec3(0.4, 0.9, 0.55));
  float lambert = max(dot(n, lightDir), 0.0);
  vec3 lit = u_color * (0.35 + 0.65 * lambert);
  vec3 highlight = mix(lit, vec3(1.0, 0.85, 0.3), u_selected * 0.45);
  outColor = vec4(highlight, 1.0);
}`;

const LINE_VERTEX_SRC = `#version 300 es
precision highp float;
layout(location = 0) in vec3 a_position;
uniform mat4 u_mvp;
void main() {
  gl_Position = u_mvp * vec4(a_position, 1.0);
}`;

const LINE_FRAGMENT_SRC = `#version 300 es
precision highp float;
uniform vec3 u_color;
out vec4 outColor;
void main() {
  outColor = vec4(u_color, 1.0);
}`;

interface Mesh {
  vao: WebGLVertexArrayObject;
  count: number;
  mode: number;
}

function compile(gl: WebGL2RenderingContext, type: number, source: string): WebGLShader {
  const shader = gl.createShader(type)!;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(shader);
    gl.deleteShader(shader);
    throw new Error(`3d-lab shader failed to compile: ${log}`);
  }
  return shader;
}

function link(gl: WebGL2RenderingContext, vertexSrc: string, fragmentSrc: string): WebGLProgram {
  const program = gl.createProgram()!;
  const vs = compile(gl, gl.VERTEX_SHADER, vertexSrc);
  const fs = compile(gl, gl.FRAGMENT_SHADER, fragmentSrc);
  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  gl.linkProgram(program);
  gl.deleteShader(vs);
  gl.deleteShader(fs);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const log = gl.getProgramInfoLog(program);
    gl.deleteProgram(program);
    throw new Error(`3d-lab program failed to link: ${log}`);
  }
  return program;
}

function cubeData(): { positions: number[]; normals: number[] } {
  const faces: Array<[number[], number[], number[], number[], number[]]> = [
    [[0, 0, 1], [-0.5, -0.5, 0.5], [0.5, -0.5, 0.5], [0.5, 0.5, 0.5], [-0.5, 0.5, 0.5]],
    [[0, 0, -1], [0.5, -0.5, -0.5], [-0.5, -0.5, -0.5], [-0.5, 0.5, -0.5], [0.5, 0.5, -0.5]],
    [[1, 0, 0], [0.5, -0.5, 0.5], [0.5, -0.5, -0.5], [0.5, 0.5, -0.5], [0.5, 0.5, 0.5]],
    [[-1, 0, 0], [-0.5, -0.5, -0.5], [-0.5, -0.5, 0.5], [-0.5, 0.5, 0.5], [-0.5, 0.5, -0.5]],
    [[0, 1, 0], [-0.5, 0.5, 0.5], [0.5, 0.5, 0.5], [0.5, 0.5, -0.5], [-0.5, 0.5, -0.5]],
    [[0, -1, 0], [-0.5, -0.5, -0.5], [0.5, -0.5, -0.5], [0.5, -0.5, 0.5], [-0.5, -0.5, 0.5]],
  ];
  const positions: number[] = [];
  const normals: number[] = [];
  for (const [normal, a, b, c, d] of faces) {
    for (const v of [a, b, c, a, c, d]) {
      positions.push(...v);
      normals.push(...normal);
    }
  }
  return { positions, normals };
}

function sphereData(segments = 24, rings = 16): { positions: number[]; normals: number[] } {
  const positions: number[] = [];
  const normals: number[] = [];
  const at = (ring: number, seg: number): number[] => {
    const phi = (ring / rings) * Math.PI;
    const theta = (seg / segments) * Math.PI * 2;
    return [
      0.5 * Math.sin(phi) * Math.cos(theta),
      0.5 * Math.cos(phi),
      0.5 * Math.sin(phi) * Math.sin(theta),
    ];
  };
  for (let ring = 0; ring < rings; ring++) {
    for (let seg = 0; seg < segments; seg++) {
      const a = at(ring, seg);
      const b = at(ring + 1, seg);
      const c = at(ring + 1, seg + 1);
      const d = at(ring, seg + 1);
      for (const v of [a, c, b, a, d, c]) {
        positions.push(...v);
        const len = Math.hypot(v[0], v[1], v[2]) || 1;
        normals.push(v[0] / len, v[1] / len, v[2] / len);
      }
    }
  }
  return { positions, normals };
}

function gridData(half = 8, step = 1): number[] {
  const lines: number[] = [];
  for (let i = -half; i <= half; i += step) {
    lines.push(i, 0, -half, i, 0, half);
    lines.push(-half, 0, i, half, 0, i);
  }
  return lines;
}

function makeMesh(
  gl: WebGL2RenderingContext,
  positions: number[],
  normals: number[] | null,
  mode: number,
): Mesh {
  const vao = gl.createVertexArray()!;
  gl.bindVertexArray(vao);

  const positionBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(positions), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);

  if (normals) {
    const normalBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, normalBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(normals), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(1);
    gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 0, 0);
  }

  gl.bindVertexArray(null);
  return { vao, count: positions.length / 3, mode };
}

function parseColor(hex: string): [number, number, number] {
  const value = hex.replace('#', '');
  const n = Number.parseInt(value.length === 3 ? value.replace(/./g, (c) => c + c) : value, 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

export function createRenderer3d(gl: WebGL2RenderingContext): Renderer3d {
  const solidProgram = link(gl, VERTEX_SRC, FRAGMENT_SRC);
  const lineProgram = link(gl, LINE_VERTEX_SRC, LINE_FRAGMENT_SRC);

  const cube = (() => {
    const { positions, normals } = cubeData();
    return makeMesh(gl, positions, normals, gl.TRIANGLES);
  })();
  const sphere = (() => {
    const { positions, normals } = sphereData();
    return makeMesh(gl, positions, normals, gl.TRIANGLES);
  })();
  const grid = makeMesh(gl, gridData(), null, gl.LINES);
  const chromeMesh = (() => {
    const vao = gl.createVertexArray()!;
    gl.bindVertexArray(vao);
    const buffer = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);
    gl.bindVertexArray(null);
    return { vao, buffer };
  })();

  const uniforms = {
    mvp: gl.getUniformLocation(solidProgram, 'u_mvp'),
    model: gl.getUniformLocation(solidProgram, 'u_model'),
    color: gl.getUniformLocation(solidProgram, 'u_color'),
    selected: gl.getUniformLocation(solidProgram, 'u_selected'),
  };
  const lineUniforms = {
    mvp: gl.getUniformLocation(lineProgram, 'u_mvp'),
    color: gl.getUniformLocation(lineProgram, 'u_color'),
  };

  return {
    /**
     * Gutters sit outside every tile's scissor, so a surface whose tile set
     * changed keeps whatever was last drawn there until something clears the
     * whole buffer. That is this.
     */
    clearAll(width, height) {
      gl.disable(gl.SCISSOR_TEST);
      gl.viewport(0, 0, width, height);
      // Transparent, not black: this buffer sits over the lab's own DOM, and
      // everything outside a tile's scissor has to keep showing through.
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    },

    draw(solids, camera, rect, chrome, cssSize) {
      if (rect.w <= 0 || rect.h <= 0) return;

      gl.enable(gl.SCISSOR_TEST);
      gl.scissor(rect.x, rect.y, rect.w, rect.h);
      gl.viewport(rect.x, rect.y, rect.w, rect.h);
      gl.clearColor(0.1, 0.11, 0.14, 1);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

      gl.enable(gl.DEPTH_TEST);
      gl.depthFunc(gl.LEQUAL);
      gl.enable(gl.CULL_FACE);
      gl.cullFace(gl.BACK);

      const viewProjection = cameraViewProjection(camera, rect.w / rect.h);

      gl.useProgram(lineProgram);
      gl.uniformMatrix4fv(lineUniforms.mvp, false, new Float32Array(viewProjection));
      gl.uniform3f(lineUniforms.color, 0.22, 0.24, 0.29);
      gl.bindVertexArray(grid.vao);
      gl.drawArrays(grid.mode, 0, grid.count);

      gl.useProgram(solidProgram);
      for (const solid of solids) {
        const model: Mat4 = compose(solid.pose.position, solid.pose.rotation, solid.pose.scale);
        gl.uniformMatrix4fv(uniforms.mvp, false, new Float32Array(multiply(viewProjection, model)));
        gl.uniformMatrix4fv(uniforms.model, false, new Float32Array(model));
        const [r, g, b] = parseColor(solid.color);
        gl.uniform3f(uniforms.color, r, g, b);
        gl.uniform1f(uniforms.selected, solid.selected ? 1 : 0);
        const mesh = solid.kind === 'sphere' ? sphere : cube;
        gl.bindVertexArray(mesh.vao);
        gl.drawArrays(mesh.mode, 0, mesh.count);
      }

      if (chrome.length > 0) {
        gl.disable(gl.DEPTH_TEST);
        gl.useProgram(lineProgram);
        gl.uniformMatrix4fv(lineUniforms.mvp, false, new Float32Array(identity()));
        gl.uniform3f(lineUniforms.color, 1, 0.85, 0.3);
        const verts: number[] = [];
        for (const box of chrome) {
          const x0 = (box.x / cssSize.width) * 2 - 1;
          const x1 = ((box.x + box.width) / cssSize.width) * 2 - 1;
          const y0 = 1 - (box.y / cssSize.height) * 2;
          const y1 = 1 - ((box.y + box.height) / cssSize.height) * 2;
          const corners = [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];
          for (let i = 0; i < 4; i++) {
            const a = corners[i];
            const b = corners[(i + 1) % 4];
            verts.push(a[0], a[1], 0, b[0], b[1], 0);
          }
        }
        gl.bindVertexArray(chromeMesh.vao);
        gl.bindBuffer(gl.ARRAY_BUFFER, chromeMesh.buffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(verts), gl.DYNAMIC_DRAW);
        gl.drawArrays(gl.LINES, 0, verts.length / 3);
      }

      gl.bindVertexArray(null);
      gl.disable(gl.SCISSOR_TEST);
    },

    dispose() {
      gl.deleteProgram(solidProgram);
      gl.deleteProgram(lineProgram);
      for (const mesh of [cube, sphere, grid]) gl.deleteVertexArray(mesh.vao);
      gl.deleteVertexArray(chromeMesh.vao);
      gl.deleteBuffer(chromeMesh.buffer);
    },
  };
}
