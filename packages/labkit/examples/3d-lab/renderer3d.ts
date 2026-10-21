/**
 * A small WebGL2 renderer: one program, flat-lit solids, a ground grid, and a
 * scissored draw so it can share one context with whatever else the lab's
 * surface is hosting.
 *
 * Deliberately naive. Batching, materials and antialiasing are not what the lab
 * measures, and they would make what it does measure harder to read.
 */

import {
  cameraViewProjection, type Camera3d, type ChromeBox, type ScreenLine, type ScreenPoint,
} from '@weasel-js/kernel3d';
import { compose, identity, multiply, type Mat4 } from '@weasel-js/geom/3d';
import { cubeData, gridData, sphereData } from './meshes3d';
import { aabbOfSolid, type Pose3, type SolidKind } from './scene3d';

/** Translucency of an uncommitted pose. The 2D ghost layer uses 0.85; a lit
 *  solid needs more of the ground showing through to read as not-yet-there. */
const GHOST_ALPHA = 0.4;

/** Just clear of the grid at y=0, which would otherwise z-fight it. */
const FOOTPRINT_Y = 0.004;

/** Warm for what is selected, cool for what a gesture is proposing — so a
 *  marquee sweeping across a selected solid stays two readable outlines. */
const CHROME_COLORS: ReadonlyArray<readonly ['selection' | 'gesture', readonly [number, number, number]]> = [
  ['selection', [1, 0.85, 0.3]],
  ['gesture', [0.45, 0.8, 1]],
];

/** What the snap in flight met, drawn over the chrome. */
const SNAP_COLOR = [1, 0.4, 0.65] as const;
/** Half the side of the square a snapped point is marked with, in CSS px. */
const SNAP_POINT_HALF = 4;

/** Snap marks in the pane's own CSS px, as `projectSnapMarks` hands them back
 *  less the pane's origin. */
export interface SnapDraw {
  lines: readonly ScreenLine[];
  points: readonly ScreenPoint[];
}

type Segment = readonly [number, number, number, number];

function boxSegments(x0: number, y0: number, x1: number, y1: number): Segment[] {
  return [[x0, y0, x1, y0], [x1, y0, x1, y1], [x1, y1, x0, y1], [x0, y1, x0, y0]];
}

export interface SolidDraw {
  pose: Pose3;
  kind: SolidKind;
  color: string;
  selected: boolean;
  /** An uncommitted pose: drawn translucent, over a footprint on the ground. */
  ghost?: boolean;
}

export interface DeviceRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Renderer3d {
  /** Erase the whole shared buffer, gutters included. The surface calls this
   *  through `registerClear` when the tile geometry changed. */
  clearAll(width: number, height: number): void;
  draw(
    solids: readonly SolidDraw[],
    camera: Camera3d,
    rect: DeviceRect,
    chrome: readonly ChromeBox[],
    cssSize: { width: number; height: number },
    snap?: SnapDraw,
  ): void;
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
uniform float u_alpha;
out vec4 outColor;
void main() {
  vec3 n = normalize(v_normal);
  vec3 lightDir = normalize(vec3(0.4, 0.9, 0.55));
  float lambert = max(dot(n, lightDir), 0.0);
  vec3 lit = u_color * (0.35 + 0.65 * lambert);
  vec3 highlight = mix(lit, vec3(1.0, 0.85, 0.3), u_selected * 0.45);
  outColor = vec4(highlight, u_alpha);
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
  const dynamicLines = (() => {
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
    alpha: gl.getUniformLocation(solidProgram, 'u_alpha'),
  };
  const lineUniforms = {
    mvp: gl.getUniformLocation(lineProgram, 'u_mvp'),
    color: gl.getUniformLocation(lineProgram, 'u_color'),
  };

  return {
    clearAll(width, height) {
      gl.disable(gl.SCISSOR_TEST);
      gl.viewport(0, 0, width, height);
      // Transparent, not black: this buffer sits over the lab's own DOM, and
      // everything outside a tile's scissor has to keep showing through.
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    },

    draw(solids, camera, rect, chrome, cssSize, snap) {
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

      const drawSolid = (solid: SolidDraw) => {
        const model: Mat4 = compose(solid.pose.position, solid.pose.rotation, solid.pose.scale);
        gl.uniformMatrix4fv(uniforms.mvp, false, new Float32Array(multiply(viewProjection, model)));
        gl.uniformMatrix4fv(uniforms.model, false, new Float32Array(model));
        const [r, g, b] = parseColor(solid.color);
        gl.uniform3f(uniforms.color, r, g, b);
        gl.uniform1f(uniforms.selected, solid.selected ? 1 : 0);
        const mesh = solid.kind === 'sphere' ? sphere : cube;
        gl.bindVertexArray(mesh.vao);
        gl.drawArrays(mesh.mode, 0, mesh.count);
      };

      gl.useProgram(solidProgram);
      gl.uniform1f(uniforms.alpha, 1);
      const ghosts: SolidDraw[] = [];
      for (const solid of solids) {
        if (solid.ghost) ghosts.push(solid);
        else drawSolid(solid);
      }

      if (ghosts.length > 0) {
        // The footprint goes down first, opaque, so the translucent body reads
        // as sitting over it rather than tinting it.
        gl.useProgram(lineProgram);
        gl.uniformMatrix4fv(lineUniforms.mvp, false, new Float32Array(viewProjection));
        gl.uniform3f(lineUniforms.color, 0.85, 0.72, 0.32);
        const verts: number[] = [];
        for (const ghost of ghosts) {
          const { min, max } = aabbOfSolid(ghost.pose, ghost.kind);
          const corners = [
            [min.x, max.z],
            [max.x, max.z],
            [max.x, min.z],
            [min.x, min.z],
          ];
          for (let i = 0; i < 4; i++) {
            const a = corners[i];
            const b = corners[(i + 1) % 4];
            verts.push(a[0], FOOTPRINT_Y, a[1], b[0], FOOTPRINT_Y, b[1]);
          }
        }
        gl.bindVertexArray(dynamicLines.vao);
        gl.bindBuffer(gl.ARRAY_BUFFER, dynamicLines.buffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(verts), gl.DYNAMIC_DRAW);
        gl.drawArrays(gl.LINES, 0, verts.length / 3);

        // Depth writes off: a ghost is depth-tested against the committed
        // solids, but two ghosts must not punch holes in each other.
        gl.enable(gl.BLEND);
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
        gl.depthMask(false);
        gl.useProgram(solidProgram);
        gl.uniform1f(uniforms.alpha, GHOST_ALPHA);
        for (const ghost of ghosts) drawSolid(ghost);
        gl.depthMask(true);
        gl.disable(gl.BLEND);
      }

      // Chrome and snap marks are screen space, over everything.
      gl.disable(gl.DEPTH_TEST);
      gl.useProgram(lineProgram);
      gl.uniformMatrix4fv(lineUniforms.mvp, false, new Float32Array(identity()));
      gl.bindVertexArray(dynamicLines.vao);
      gl.bindBuffer(gl.ARRAY_BUFFER, dynamicLines.buffer);
      const drawSegments = (segments: readonly Segment[], rgb: readonly [number, number, number]) => {
        if (segments.length === 0) return;
        const verts: number[] = [];
        const x = (v: number) => (v / cssSize.width) * 2 - 1;
        const y = (v: number) => 1 - (v / cssSize.height) * 2;
        for (const [ax, ay, bx, by] of segments) verts.push(x(ax), y(ay), 0, x(bx), y(by), 0);
        gl.uniform3f(lineUniforms.color, rgb[0], rgb[1], rgb[2]);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(verts), gl.DYNAMIC_DRAW);
        gl.drawArrays(gl.LINES, 0, verts.length / 3);
      };
      for (const [tint, rgb] of CHROME_COLORS) {
        drawSegments(chrome
          .filter((box) => (box.tint ?? 'selection') === tint)
          .flatMap((box) => boxSegments(box.x, box.y, box.x + box.width, box.y + box.height)), rgb);
      }
      if (snap) {
        const h = SNAP_POINT_HALF;
        drawSegments([
          ...snap.lines.map((l): Segment => [l.from.x, l.from.y, l.to.x, l.to.y]),
          ...snap.points.flatMap((p) => boxSegments(p.at.x - h, p.at.y - h, p.at.x + h, p.at.y + h)),
        ], SNAP_COLOR);
      }

      gl.bindVertexArray(null);
      gl.disable(gl.SCISSOR_TEST);
    },

    dispose() {
      gl.deleteProgram(solidProgram);
      gl.deleteProgram(lineProgram);
      for (const mesh of [cube, sphere, grid]) gl.deleteVertexArray(mesh.vao);
      gl.deleteVertexArray(dynamicLines.vao);
      gl.deleteBuffer(dynamicLines.buffer);
    },
  };
}
