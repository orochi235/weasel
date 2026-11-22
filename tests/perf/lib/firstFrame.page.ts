/**
 * The page `first-frame.spec.ts` loads: a blank document, so nothing has compiled a program before the
 * renderer under test does, and the two functions the spec calls in it.
 */

export interface FrameSample {
  glRenderer: string;
  /** `new WeaselRenderer`. */
  createMs: number;
  /** The first `render` and its readback. */
  firstMs: number;
  /** From before `new WeaselRenderer` to the end of the first frame that drew everything. */
  readyMs: number;
  /** The longest main-thread task meanwhile, from a `longtask` observer; 0 if none passed 50 ms. */
  blockMs: number;
  /** A frame after the scene is ready, with its readback. */
  secondMs: number;
  /** Whether the page held each frame until `programsReady`, as a host can. */
  held: boolean;
  /** Frames rendered until ready. */
  frames: number;
  /** Programs linked until ready. */
  links: number;
  /** Time inside each timed GL call until ready, by call. */
  gl: Record<string, number>;
  /** Whether the context offers `KHR_parallel_shader_compile`. */
  parallel: boolean;
  /** The length of each linked program's fragment source, in link order, to match against `ProgramSample.fragLength`. */
  linked: number[];
}

export interface ProgramSample {
  name: string;
  /** Waiting on both stages' compile status. */
  compileMs: number;
  /** Waiting on the link status. */
  linkMs: number;
  /** Source to linked program, calls and waits together. */
  totalMs: number;
  fragLength: number;
}

const SCRIPT = /* js */ `
const TIMED = ['compileShader', 'getShaderParameter', 'linkProgram', 'getProgramParameter',
  'getUniformLocation', 'getAttribLocation', 'useProgram', 'drawElements', 'drawArrays', 'readPixels',
  'texImage2D', 'texSubImage2D', 'bufferData', 'bufferSubData'];
const spent = {};
let links = 0;
const proto = WebGL2RenderingContext.prototype;
for (const name of TIMED) {
  const orig = proto[name];
  proto[name] = function (...args) {
    const t0 = performance.now();
    try { return orig.apply(this, args); } finally { spent[name] = (spent[name] ?? 0) + performance.now() - t0; }
  };
}
const sources = new WeakMap();
const attached = new WeakMap();
const linked = [];
const shaderSourceOf = proto.shaderSource;
proto.shaderSource = function (sh, src) { sources.set(sh, src); return shaderSourceOf.call(this, sh, src); };
const attach = proto.attachShader;
proto.attachShader = function (p, sh) {
  if (this.getShaderParameter(sh, this.SHADER_TYPE) === this.FRAGMENT_SHADER) attached.set(p, (sources.get(sh) ?? '').length);
  return attach.call(this, p, sh);
};
const link = proto.linkProgram;
proto.linkProgram = function (p) { links++; linked.push(attached.get(p) ?? -1); return link.call(this, p); };

const source = proto.shaderSource;
let nonce = null;
const MAIN = /\\bvoid\\s+main\\s*\\(\\s*(?:void\\s*)?\\)/;
globalThis.__coldShaders = (n) => { nonce = n; };
proto.shaderSource = function (shader, src) {
  if (nonce === null || !MAIN.test(src)) return source.call(this, shader, src);
  const name = 'cold_' + nonce;
  return source.call(this, shader, src.replace(MAIN, 'void ' + name + '()') + '\\nvoid main() { ' + name + '(); }\\n');
};

let longest = 0;
new PerformanceObserver((list) => {
  for (const e of list.getEntries()) longest = Math.max(longest, e.duration);
}).observe({ type: 'longtask', buffered: true });

const raf = () => new Promise((r) => requestAnimationFrame(() => r()));
const idle = () => new Promise((r) => setTimeout(r, 0));

function scene(G, w, h) {
  const out = [];
  const cols = 14, rows = 9, cw = w / cols, ch = h / rows;
  for (let i = 0; i < cols * rows; i++) {
    const x = (i % cols) * cw, y = Math.floor(i / cols) * ch;
    const hue = (i * 37) % 360;
    out.push({ kind: 'path', path: G.rectPath(x + 2, y + 2, cw - 4, ch - 4),
      fill: { paint: { kind: 'solid', color: 'hsl(' + hue + ', 60%, 55%)' } },
      stroke: { paint: { kind: 'solid', color: '#202020' }, width: 1 } });
    if (i % 5 === 0) out.push({ kind: 'path', path: G.circlePath(x + 14, y + 14, 6),
      fill: { paint: { kind: 'solid', color: '#ffffff' } } });
    out.push(globalThis.__R.textCommandFromRuns(x + 8, y + ch - 22,
      [{ text: 'area ' + i, fill: { paint: { kind: 'solid', color: '#101010' } } }],
      { fontSize: 12, fontFamily: 'sans-serif' }));
  }
  out.push({ kind: 'path', path: G.rectPath(0, 0, w, 6), fill: { paint: {
    kind: 'linear-gradient', from: { x: 0, y: 0 }, to: { x: w, y: 0 }, units: 'local',
    stops: [{ offset: 0, color: '#2040ff' }, { offset: 1, color: '#ff4020' }] } } });
  return out;
}

globalThis.__firstFrame = async (root, hold) => {
  const R = await import('/weasel/@fs' + root + '/packages/renderer/src/index.ts');
  const G = await import('/weasel/@fs' + root + '/packages/geom/src/index.ts');
  globalThis.__R = R;
  await R.registerFont('sans-serif', { weight: 400, style: 'normal' }, '/weasel/inter/inter.json', '/weasel/inter/inter.png');
  const w = 1200, h = 720;
  const canvas = document.createElement('canvas');
  canvas.width = w; canvas.height = h;
  document.body.appendChild(canvas);
  const gl = canvas.getContext('webgl2', { stencil: true, antialias: true });
  if (!gl) throw new Error('no WebGL2 context');
  const dbg = gl.getExtension('WEBGL_debug_renderer_info');
  const glRenderer = String(dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER));
  const commands = scene(G, w, h);
  const px = new Uint8Array(4);
  await raf();
  for (const k of Object.keys(spent)) delete spent[k];
  links = 0;
  linked.length = 0;
  longest = 0;
  const parallel = gl.getExtension('KHR_parallel_shader_compile') !== null;

  const t0 = performance.now();
  const renderer = new R.WeaselRenderer({ gl, canvas, width: w, height: h, dpr: 1 });
  const createMs = performance.now() - t0;
  let firstMs = 0, readyAt = 0, frames = 0, quiet = 0, readyLinks = 0;
  const gl0 = {};
  while (quiet < 3 && frames < 600) {
    if (hold && renderer.programsReady && !renderer.programsReady()) {
      await raf();
      continue;
    }
    const before = links;
    const f0 = performance.now();
    const complete = renderer.render(commands) !== false;
    gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
    const f1 = performance.now();
    frames++;
    if (frames === 1) firstMs = f1 - f0;
    if (links !== before || !complete || renderer.pendingPrograms?.() > 0) {
      quiet = 0;
      readyAt = f1;
      readyLinks = links;
      Object.assign(gl0, spent);
    } else {
      quiet++;
      if (readyAt === 0) { readyAt = f1; readyLinks = links; Object.assign(gl0, spent); }
    }
    await raf();
  }
  await idle();
  const s0 = performance.now();
  renderer.render(commands);
  gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
  const secondMs = performance.now() - s0;
  await new Promise((r) => setTimeout(r, 100));
  const blockMs = longest;
  renderer.dispose();
  canvas.remove();
  return { glRenderer, createMs, firstMs, readyMs: readyAt - t0, blockMs, secondMs, frames, links: readyLinks, gl: gl0, parallel, held: Boolean(hold && renderer.programsReady), linked: linked.slice(0, readyLinks) };
};

globalThis.__programs = async (root) => {
  const at = (p) => import('/weasel/@fs' + root + '/packages/renderer/src/' + p);
  const B = await at('shaders/builtinPrograms.ts');
  const F = await at('shaders/batchFill.ts');
  const { withIdOutput } = await at('shaders/idOutput.ts');
  const specs = [
    ['batch', { vert: F.BATCH_VERT_SRC, frag: F.BATCH_FRAG_SRC }],
    ['batch-matrices', B.BATCH_FILL_MATRICES_SPEC],
    ['batch-area', { vert: F.BATCH_AREA_VERT_SRC, frag: F.batchAreaFragSrc(false, false) }],
    ['batch-area-hull', { vert: F.BATCH_AREA_VERT_SRC, frag: F.batchAreaFragSrc(false, true) }],
    ['path-fill', B.PATH_FILL_SPEC],
    ['path-fill-vcolor', B.PATH_FILL_VCOLOR_SPEC],
    ['grad-fill', B.GRAD_FILL_SPEC],
    ['pattern-fill', B.PATTERN_FILL_SPEC],
    ['glyph-layer', B.GLYPH_LAYER_SPECS[0]],
    ['glyph-layer-area', B.GLYPH_LAYER_SPECS[1]],
    ['glyph-texture', B.GLYPH_PAINT_SPECS.texture],
  ];
  const out = [];
  for (const [name, spec] of specs) {
    const canvas = document.createElement('canvas');
    canvas.width = 16; canvas.height = 16;
    const gl = canvas.getContext('webgl2', { stencil: true });
    const src = withIdOutput(spec.vert, spec.frag) ?? spec;
    const t0 = performance.now();
    const shaders = [[gl.VERTEX_SHADER, src.vert], [gl.FRAGMENT_SHADER, src.frag]].map(([type, s]) => {
      const sh = gl.createShader(type);
      gl.shaderSource(sh, s);
      gl.compileShader(sh);
      return sh;
    });
    const c0 = performance.now();
    for (const sh of shaders) {
      if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) throw new Error(name + ': ' + gl.getShaderInfoLog(sh));
    }
    const c1 = performance.now();
    const p = gl.createProgram();
    for (const sh of shaders) gl.attachShader(p, sh);
    gl.linkProgram(p);
    const l0 = performance.now();
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(name + ': ' + gl.getProgramInfoLog(p));
    const l1 = performance.now();
    out.push({ name, compileMs: c1 - c0, linkMs: l1 - l0, totalMs: l1 - t0, fragLength: src.frag.length });
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    await idle();
  }
  return out;
};
`;

export const FIRST_FRAME_PAGE = `<!doctype html><html><head><meta charset="utf-8"><title>first frame</title></head>
<body style="margin:0"><script type="module">${SCRIPT}</script></body></html>`;
