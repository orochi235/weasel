/**
 * Page half of `back-to-back.spec.ts`: raw WebGL2, no weasel. Loaded into a
 * blank page through vite (`/weasel/@fs…/tests/perf/lib/backToBack.page.ts`).
 */

export type Kind = 'subdata' | 'ring' | 'uniform';
export type Sync = 'read' | 'finish' | 'flush' | 'none';

export interface Cell {
  kind: Kind;
  /** Draw calls per frame. */
  draws: number;
  /** Frames drawn before yielding to the event loop; `0` means never. */
  perTask: number;
  yieldBy: 'timeout' | 'message';
  /** What each frame ends in. `none` reads one pixel only at the end of each task. */
  sync: Sync;
  /** Busy-wait this long after each frame, inside the task. */
  spinMs: number;
  preserveDrawingBuffer: boolean;
  target: 'default' | 'fbo';
  attached: boolean;
  discard: boolean;
  gpuTimer: boolean;
  frames: number;
  /** Idle before the first frame. */
  settleMs: number;
}

export interface CellResult {
  /** Wall time of each frame, its sync included, ms. */
  frames: number[];
  /** Wall time from the first frame's start to the end of the last frame's task, ms. */
  totalMs: number;
  /** GPU time of each frame from `EXT_disjoint_timer_query_webgl2`, ms, where it reported one. */
  gpu: (number | null)[] | null;
  /** A fixed JS loop timed before each frame, ms: whether the page's own thread slows too. */
  js: number[];
}

const VS = `#version 300 es
in vec2 a_pos;
uniform vec2 u_offset;
uniform vec2 u_size;
void main() {
  vec2 p = (a_pos + u_offset) / u_size * 2.0 - 1.0;
  gl_Position = vec4(p.x, -p.y, 0.0, 1.0);
}`;
const FS = `#version 300 es
precision mediump float;
uniform vec4 u_color;
out vec4 o;
void main() { o = u_color; }`;

const W = 800;
const H = 600;
const RECT = 36;
const RING_SLOTS = 4096;

interface Ctx {
  canvas: HTMLCanvasElement;
  gl: WebGL2RenderingContext;
  loc: { offset: WebGLUniformLocation; color: WebGLUniformLocation };
  vbo: WebGLBuffer;
  fbo: WebGLFramebuffer;
  timer: { TIME_ELAPSED_EXT: number; GPU_DISJOINT_EXT: number } | null;
  glRenderer: string;
}

const contexts = new Map<string, Ctx>();

function compile(gl: WebGL2RenderingContext): WebGLProgram {
  const prog = gl.createProgram()!;
  for (const [type, src] of [[gl.VERTEX_SHADER, VS], [gl.FRAGMENT_SHADER, FS]] as const) {
    const sh = gl.createShader(type)!;
    gl.shaderSource(sh, src);
    gl.compileShader(sh);
    gl.attachShader(prog, sh);
  }
  gl.bindAttribLocation(prog, 0, 'a_pos');
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog) ?? 'link failed');
  return prog;
}

function quad(x: number, y: number): Float32Array {
  return new Float32Array([x, y, x + RECT, y, x + RECT, y + RECT, x, y + RECT]);
}

function context(pdb: boolean, attached: boolean): Ctx {
  const key = `${pdb}:${attached}`;
  const have = contexts.get(key);
  if (have) return have;
  const canvas = document.createElement('canvas');
  canvas.width = W; canvas.height = H;
  if (attached) document.body.appendChild(canvas);
  const gl = canvas.getContext('webgl2', { preserveDrawingBuffer: pdb, antialias: false, stencil: true })!;
  const prog = compile(gl);
  gl.useProgram(prog);
  gl.uniform2f(gl.getUniformLocation(prog, 'u_size'), W, H);
  const vao = gl.createVertexArray();
  gl.bindVertexArray(vao);
  const vbo = gl.createBuffer()!;
  gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
  gl.bufferData(gl.ARRAY_BUFFER, RING_SLOTS * 32, gl.DYNAMIC_DRAW);
  gl.bufferSubData(gl.ARRAY_BUFFER, 0, quad(0, 0));
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  const ibo = gl.createBuffer();
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ibo);
  const idx = new Uint16Array(RING_SLOTS * 6);
  for (let i = 0; i < RING_SLOTS; i++) idx.set([0, 1, 2, 0, 2, 3].map((v) => v + i * 4), i * 6);
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, idx, gl.STATIC_DRAW);
  const tex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texStorage2D(gl.TEXTURE_2D, 1, gl.RGBA8, W, H);
  const fbo = gl.createFramebuffer()!;
  gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  const dbg = gl.getExtension('WEBGL_debug_renderer_info');
  const ctx: Ctx = {
    canvas, gl, vbo, fbo,
    loc: { offset: gl.getUniformLocation(prog, 'u_offset')!, color: gl.getUniformLocation(prog, 'u_color')! },
    timer: gl.getExtension('EXT_disjoint_timer_query_webgl2'),
    glRenderer: String(dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER)),
  };
  contexts.set(key, ctx);
  return ctx;
}

const px = (i: number) => 20 + ((i * 37) % (W - 160));
const py = (i: number) => 20 + ((i * 53) % (H - 160));

/** One frame: clear, then `draws` one-rect draws in the shape `kind` names. */
function frame(c: Ctx, cell: Cell, ring: { next: number }): void {
  const { gl, loc } = c;
  gl.bindFramebuffer(gl.FRAMEBUFFER, cell.target === 'fbo' ? c.fbo : null);
  gl.viewport(0, 0, W, H);
  if (cell.discard) gl.enable(gl.RASTERIZER_DISCARD);
  gl.clearColor(1, 1, 1, 1);
  gl.clear(gl.COLOR_BUFFER_BIT);
  for (let i = 0; i < cell.draws; i++) {
    gl.uniform4f(loc.color, i % 2 ? 0.2 : 0.8, 0.4, i % 2 ? 0.8 : 0.2, 1);
    if (cell.kind === 'uniform') {
      gl.uniform2f(loc.offset, px(i), py(i));
      gl.drawElements(gl.TRIANGLES, 6, gl.UNSIGNED_SHORT, 0);
    } else if (cell.kind === 'subdata') {
      gl.uniform2f(loc.offset, 0, 0);
      gl.bufferSubData(gl.ARRAY_BUFFER, 0, quad(px(i), py(i)));
      gl.drawElements(gl.TRIANGLES, 6, gl.UNSIGNED_SHORT, 0);
    } else {
      const slot = ring.next++ % RING_SLOTS;
      gl.uniform2f(loc.offset, 0, 0);
      gl.bufferSubData(gl.ARRAY_BUFFER, slot * 32, quad(px(i), py(i)));
      gl.drawElements(gl.TRIANGLES, 6, gl.UNSIGNED_SHORT, slot * 12);
    }
  }
  if (cell.discard) gl.disable(gl.RASTERIZER_DISCARD);
}

const pixel = new Uint8Array(4);

function sync(gl: WebGL2RenderingContext, how: Sync): void {
  if (how === 'read') gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixel);
  else if (how === 'finish') gl.finish();
  else if (how === 'flush') gl.flush();
}

const channel = new MessageChannel();
const waiting: Array<() => void> = [];
channel.port1.onmessage = () => waiting.shift()?.();

function yieldTask(by: Cell['yieldBy']): Promise<void> {
  if (by === 'timeout') return new Promise((r) => setTimeout(r, 0));
  return new Promise((r) => { waiting.push(r); channel.port2.postMessage(0); });
}

function spin(ms: number): void {
  const t = performance.now();
  while (performance.now() - t < ms) { /* busy */ }
}

let sink = 0;
function jsProbe(): number {
  const t = performance.now();
  let a = sink;
  for (let i = 0; i < 20000; i++) a = (a * 1103515245 + 12345) | 0;
  sink = a;
  return performance.now() - t;
}

function collectGpu(gl: WebGL2RenderingContext, ext: NonNullable<Ctx['timer']>, qs: WebGLQuery[]): Promise<(number | null)[]> {
  return new Promise((resolve) => {
    const t0 = performance.now();
    const poll = () => {
      const ready = qs.every((q) => gl.getQueryParameter(q, gl.QUERY_RESULT_AVAILABLE));
      if (ready || performance.now() - t0 > 2000) {
        const disjoint = gl.getParameter(ext.GPU_DISJOINT_EXT) as boolean;
        resolve(qs.map((q) => {
          const ok = !disjoint && gl.getQueryParameter(q, gl.QUERY_RESULT_AVAILABLE);
          const ns = ok ? (gl.getQueryParameter(q, gl.QUERY_RESULT) as number) : null;
          gl.deleteQuery(q);
          return ns === null ? null : ns / 1e6;
        }));
      } else setTimeout(poll, 5);
    };
    poll();
  });
}

export async function runCell(cell: Cell): Promise<CellResult> {
  const c = context(cell.preserveDrawingBuffer, cell.attached);
  const { gl } = c;
  const ring = { next: 0 };
  frame(c, { ...cell, draws: 1 }, ring);
  gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixel);
  await new Promise((r) => setTimeout(r, cell.settleMs));
  await yieldTask(cell.yieldBy);
  const frames: number[] = [];
  const js: number[] = [];
  const queries: WebGLQuery[] = [];
  const timer = cell.gpuTimer ? c.timer : null;
  const start = performance.now();
  for (let k = 0; k < cell.frames; k++) {
    js.push(jsProbe());
    performance.mark(`b2b-f${k}`);
    const t0 = performance.now();
    const q = timer ? gl.createQuery()! : null;
    if (q && timer) gl.beginQuery(timer.TIME_ELAPSED_EXT, q);
    frame(c, cell, ring);
    if (q && timer) { gl.endQuery(timer.TIME_ELAPSED_EXT); queries.push(q); }
    sync(gl, cell.sync);
    frames.push(performance.now() - t0);
    if (cell.spinMs > 0) spin(cell.spinMs);
    const endOfTask = cell.perTask > 0 && (k + 1) % cell.perTask === 0;
    if (endOfTask || k === cell.frames - 1) {
      if (cell.sync === 'none') gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixel);
    }
    if (endOfTask) await yieldTask(cell.yieldBy);
  }
  const totalMs = performance.now() - start;
  performance.mark('b2b-end');
  const gpu = timer ? await collectGpu(gl, timer, queries) : null;
  return { frames, totalMs, gpu, js };
}

export function rendererName(): string {
  return context(true, false).glRenderer;
}

export function dropContexts(): void {
  for (const c of contexts.values()) {
    c.gl.getExtension('WEBGL_lose_context')?.loseContext();
    c.canvas.remove();
  }
  contexts.clear();
}
