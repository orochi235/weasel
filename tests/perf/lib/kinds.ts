/**
 * One draw command per renderer command kind, shared by the perf specs.
 *
 * Imported *by the page*, not by the Node side of a spec: the specs already
 * pull the renderer over vite's `@fs` route, and this rides the same one. It
 * therefore imports nothing — a bare-specifier import here would need the
 * package's tsconfig aliases, which the browser does not have.
 *
 * Every builder takes an index and returns a leaf at a position derived from
 * it, so the same index means the same place whatever the kind, and a frame
 * that mixes kinds spreads them the way a frame of one kind does.
 */

const PATH_M = 0;
const PATH_L = 1;
const PATH_Z = 4;

export interface KindResources {
  W: number;
  H: number;
  /** Several distinct bitmaps: one texture would never rebind, and a
   *  document with images has more than one. */
  bitmaps: ImageBitmap[];
  /** A `TextureHandle` from `registerTexture`, for the pattern fill. */
  pattern: { id: string };
  /** A `ShaderProgramHandle` from `registerProgram`, already registered on
   *  the renderer under test. */
  shader: unknown;
}

export type LeafBuilder = (i: number) => unknown;

/**
 * Every kind the draw loop dispatches differently. `solid` is the only one
 * that batches; the rest each bind their own program, texture or stencil
 * state, which is what makes a boundary between two of them cost anything.
 */
export const KIND_IDS = [
  'solid', 'gradient', 'pattern', 'image', 'text', 'shader', 'vcolor', 'stencil', 'clip',
] as const;

export type KindId = (typeof KIND_IDS)[number];

export function makeKindBuilders(res: KindResources): Record<KindId, LeafBuilder> {
  const { W, H, bitmaps, pattern, shader } = res;

  /** Index 0 lands at (20, 20) whatever the kind, so a paint probe knows
   *  where to look. */
  const px = (i: number) => 20 + ((i * 37) % (W - 160));
  const py = (i: number) => 20 + ((i * 53) % (H - 160));

  const solidPaint = (i: number) => ({
    fill: 'solid' as const, color: i % 2 ? '#3366cc' : '#cc6633',
  });

  const rectPath = (i: number, size = 36) => ({
    kind: 'rect' as const, x: px(i), y: py(i), width: size, height: size,
  });

  const solid = (i: number) => ({ kind: 'path', path: rectPath(i), fill: solidPaint(i) });

  const gradient = (i: number) => {
    const x = px(i);
    const y = py(i);
    return {
      kind: 'path',
      path: rectPath(i),
      // Anchored to the rect: a gradient whose ramp falls outside the shape it
      // fills is a solid fill wearing a gradient's cost profile.
      fill: {
        fill: 'linear-gradient' as const,
        from: { x, y }, to: { x: x + 36, y: y + 36 },
        stops: [{ offset: 0, color: '#204080' }, { offset: 1, color: '#f0b040' }],
      },
    };
  };

  const patternFill = (i: number) => ({
    kind: 'path',
    path: rectPath(i),
    fill: { fill: 'pattern' as const, pattern, origin: { x: i % 8, y: i % 8 } },
  });

  const image = (i: number) => ({
    kind: 'image',
    image: bitmaps[i % bitmaps.length],
    x: px(i), y: py(i), w: 48, h: 48,
  });

  const LABELS = [
    'Layer options', 'Fill and stroke', 'Untitled group',
    'Export preset', 'Constraints', 'Bounding box',
    'Auto layout on', 'Blend passthru',
  ];
  const text = (i: number) => ({
    kind: 'text',
    x: px(i), y: py(i),
    runs: [{
      text: LABELS[i % LABELS.length],
      fontFamily: 'sans-serif', fontSize: 16, fontWeight: 400, fontStyle: 'normal',
      fill: { fill: 'solid', color: i % 2 ? '#222222' : '#0b5' },
      letterSpacing: 0, underline: false, strikethrough: false, baselineShift: 0,
    }],
    align: 'left',
    style: { fontFamily: 'sans-serif', fontSize: 16, fill: { color: '#222222' } },
  });

  const shaderPanel = (i: number) => ({
    kind: 'shader',
    program: shader,
    // Varies per command on purpose: a constant uniform is cached and skipped,
    // which no animated shader panel gets to do.
    uniforms: { u_phase: (i % 32) * 0.2 },
    bounds: { x: px(i), y: py(i), w: 64, h: 64 },
  });

  /** A rect fill whose four anchors carry their own colors, which takes the
   *  per-vertex-color route: its own program and a color VBO minted per draw. */
  const vcolor = (i: number) => {
    const colors: number[] = [];
    for (let k = 0; k < 4; k++) {
      colors.push((k + 1) / 4, ((i + k) % 4) / 4, 1 - k / 4, 1);
    }
    return {
      kind: 'path',
      path: rectPath(i),
      fill: { fill: 'solid' as const, color: '#ffffff' },
      vertexColors: colors,
    };
  };

  /** An even-odd polygon, which tessellates to `requiresStencil` and takes the
   *  two-pass stencil fill rather than the batch. */
  const stencil = (i: number) => {
    const x = px(i);
    const y = py(i);
    const c = new Float32Array([
      x, y, x + 36, y, x + 36, y + 36, x, y + 36,
      x + 9, y + 9, x + 27, y + 9, x + 27, y + 27, x + 9, y + 27,
    ]);
    return {
      kind: 'path',
      path: {
        kind: 'polygon',
        commands: new Uint8Array([
          PATH_M, PATH_L, PATH_L, PATH_L, PATH_Z,
          PATH_M, PATH_L, PATH_L, PATH_L, PATH_Z,
        ]),
        coords: c,
        fillRule: 'evenodd',
      },
      fill: solidPaint(i),
    };
  };

  /** One solid rect inside its own clipped group — the unit the frame-budget
   *  spec prices at ~65 us. */
  const clip = (i: number) => ({
    kind: 'group',
    clip: {
      kind: 'rect' as const,
      x: px(i) - 6, y: py(i) - 6, width: 100, height: 100,
    },
    children: [solid(i)],
  });

  return { solid, gradient, pattern: patternFill, image, text, shader: shaderPanel, vcolor, stencil, clip };
}

/** A 32x32 checker, registered as the pattern tile. */
export function checkerBitmap(): Promise<ImageBitmap> {
  const px = new ImageData(32, 32);
  for (let p = 0; p < 32 * 32; p++) {
    const on = (((p >> 5) >> 3) + ((p & 31) >> 3)) % 2 === 0;
    px.data[p * 4] = on ? 220 : 40;
    px.data[p * 4 + 1] = on ? 120 : 160;
    px.data[p * 4 + 2] = on ? 60 : 200;
    px.data[p * 4 + 3] = 255;
  }
  return createImageBitmap(px);
}

/** Distinct bitmaps for the image kind. */
export async function imageBitmaps(count: number): Promise<ImageBitmap[]> {
  const out: ImageBitmap[] = [];
  for (let b = 0; b < count; b++) {
    const px = new ImageData(64, 64);
    for (let p = 0; p < 64 * 64; p++) {
      px.data[p * 4] = (p * 7 + b * 40) % 256;
      px.data[p * 4 + 1] = (p * 3 + b * 17) % 256;
      px.data[p * 4 + 2] = (p * 11 + b * 90) % 256;
      px.data[p * 4 + 3] = 255;
    }
    out.push(await createImageBitmap(px));
  }
  return out;
}

export const PANEL_FRAG = `#version 300 es
precision mediump float;
in vec2 v_uv;
uniform float u_phase;
out vec4 outColor;
void main() {
  float v = 0.5 + 0.5 * sin((v_uv.x + v_uv.y) * 12.0 + u_phase);
  float a = 0.85;
  outColor = vec4(vec3(v, 0.4, 1.0 - v) * a, a);
}`;
