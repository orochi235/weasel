import {
  cachedPaintRuns, glyphTurn, QUAD_STRIDE, SYNTHETIC_ITALIC_RADIANS, textEngineGeneration,
  type LaidOutGroup, type PaintRunsOptions,
} from '@weasel-js/text';
import {
  dynamicPageTextureId, ensureFontTexture, glyphFieldScale, glyphGeneration, glyphNeedsArea, hasFontOutlines,
  syncDynamicPageTexture, textureCacheKey, GLYPH_MODE_MSDF, GLYPH_MODE_R8, SYNTH_BOLD_AMOUNT,
} from '@weasel-js/font';
import { isSolidPaint, parseColor } from '@weasel-js/paint';
import type { TextDrawCommand, TextLayerDrawCommand } from '../DrawCommand';
import type { GpuBuffer, GpuDevice, GpuGeometry } from '../gpu/types';
import { BATCH_TEXTURE_SLOTS, RAMP_SLOT, packSlot } from '../shaders/batchFill';
import { GLYPH_INSTANCE_FLOATS, GLYPH_LAYER_LOCATIONS as L } from '../shaders/glyphLayer';
import { laidOutText } from '../textLayout';
import type { DrawContext } from './drawContext';
import { drawText, glyphPaintKindOf, OUTLINE_MIN_SCREEN_PX } from './text';
import { flushForOwnDraw } from './clip';
import { drawTriangles } from './drawTriangles';
import { modelScale } from './modelScale';
import { clipTest } from './stencil';
import { setColorUniform, setProjAndModel } from './uniforms';
import { uploadBatchMatrices } from './batchMatrices';

/** Slots a draw can give atlases: slot 0 is the white texel and the last the ramp atlas. */
const ATLAS_SLOTS = RAMP_SLOT - 1;

/** An atlas a draw samples, at slot `index + 1`. */
interface AtlasUse {
  readonly id: string;
  readonly fieldScale: readonly [number, number];
  readonly group: Pick<LaidOutGroup, 'source' | 'page' | 'family' | 'weight' | 'style'>;
}

/** One instanced draw: the glyphs between two changes of atlas set. */
interface Span {
  readonly buffer: GpuBuffer;
  readonly geometry: GpuGeometry;
  readonly count: number;
  readonly atlases: readonly AtlasUse[];
}

/** What decides whether a group's glyphs take area coverage: `glyphNeedsArea`'s
 *  inputs, less the transform. */
interface AreaProbe {
  readonly fieldScale: readonly [number, number];
  /** Layer units across a unit of texture coordinate, on each axis. */
  readonly perU: number;
  readonly perV: number;
}

/** A layer as uploaded. */
interface Layer {
  generation: string;
  /** Some glyph's texture was not ready, so the next frame builds it again. */
  complete: boolean;
  /** Something in it the instances cannot carry: every frame draws it text by text. */
  fallback: boolean;
  origin: readonly [number, number];
  spans: Span[];
  probes: AreaProbe[];
  /** The largest size a run in a face with outlines is set at; `-Infinity` for none. */
  outlineSize: number;
  touched: number;
}

/** No outline tier: the layer draws from atlases, and stands aside where the tier would take a glyph. */
const NO_OUTLINES: PaintRunsOptions = { outlineMinSize: undefined };

const generationNow = (): string => `${glyphGeneration()}:${textEngineGeneration()}`;

/**
 * The text layers a context holds, by the `texts` array each was drawn from.
 * Each holds one instance buffer a span; the corner buffer and the quad's
 * indices are shared.
 */
export class TextLayers {
  private readonly layers = new Map<readonly TextDrawCommand[], Layer>();
  private corners: GpuBuffer | null = null;
  private indices: GpuBuffer | null = null;
  private serial = 0;

  constructor(private readonly gpu: GpuDevice) {}

  /** `texts` uploaded, built again if a glyph it shows has changed since. */
  layerFor(ctx: DrawContext, texts: readonly TextDrawCommand[]): Layer {
    const generation = generationNow();
    let layer = this.layers.get(texts);
    if (layer !== undefined && (layer.generation !== generation || !layer.complete)) {
      this.free(layer);
      layer = undefined;
    }
    if (layer === undefined) {
      layer = this.build(ctx, texts, generation);
      this.layers.set(texts, layer);
    }
    layer.touched = this.serial;
    return layer;
  }

  /** Free every layer no frame drew since the last call. */
  endFrame(): void {
    for (const [texts, layer] of this.layers) {
      if (layer.touched !== this.serial) {
        this.free(layer);
        this.layers.delete(texts);
      }
    }
    this.serial++;
  }

  dispose(): void {
    for (const layer of this.layers.values()) this.free(layer);
    this.layers.clear();
    if (this.corners) this.gpu.deleteBuffer(this.corners);
    if (this.indices) this.gpu.deleteBuffer(this.indices);
    this.corners = this.indices = null;
  }

  /** Forget what a lost context took with it. */
  abandon(): void {
    this.layers.clear();
    this.corners = this.indices = null;
  }

  private free(layer: Layer): void {
    for (const s of layer.spans) {
      this.gpu.deleteGeometry(s.geometry);
      this.gpu.deleteBuffer(s.buffer);
    }
    layer.spans = [];
  }

  private build(ctx: DrawContext, texts: readonly TextDrawCommand[], generation: string): Layer {
    const first = texts[0];
    const layer: Layer = {
      generation, complete: true, fallback: false, origin: first ? [first.x, first.y] : [0, 0],
      spans: [], probes: [], outlineSize: -Infinity, touched: this.serial,
    };
    const out = new InstanceWriter();
    let atlases: AtlasUse[] = [];
    const close = () => {
      if (out.count > 0) layer.spans.push(this.upload(out, atlases));
      out.count = 0;
      atlases = [];
    };
    for (const text of texts) {
      if (text.runs.some((r) => r.stroke !== undefined)) return withFallback(layer);
      const { laid, dx, dy } = laidOutText(text);
      const { groups, decorations } = cachedPaintRuns(laid, text.runs, NO_OUTLINES, 'read');
      if (decorations.length > 0) return withFallback(layer);
      for (const group of groups) {
        if (group.source === 'outline' || group.source === 'color') return withFallback(layer);
        const fill = group.fill?.paint;
        if (fill === undefined) continue;
        if (glyphPaintKindOf(fill) !== null) return withFallback(layer);
        if (hasFontOutlines(group.family, group.weight, group.style)) {
          for (const r of text.runs) layer.outlineSize = Math.max(layer.outlineSize, r.fontSize);
        }
        if (!textureReady(ctx, group)) {
          layer.complete = false;
          continue;
        }
        if (group.quadData.length === 0) continue;
        const canvas = group.source === 'canvas';
        const fieldScale = glyphFieldScale(canvas ? 'canvas' : 'atlas', group.family, group.weight, group.style);
        if (!fieldScale) continue;
        const id = canvas ? dynamicPageTextureId(group.page) : textureCacheKey(group.family, group.weight, group.style);
        let slot = atlases.findIndex((a) => a.id === id);
        if (slot < 0) {
          if (atlases.length === ATLAS_SLOTS) close();
          atlases.push({ id, fieldScale, group });
          slot = atlases.length - 1;
        }
        addProbe(layer.probes, fieldScale, group.quadData);
        const color = parseColor(isSolidPaint(fill) ? fill.color : '#000');
        const opacity = isSolidPaint(fill) ? fill.opacity ?? 1 : 1;
        out.group(
          group.quadData, dx - layer.origin[0], dy - layer.origin[1],
          color[0], color[1], color[2], color[3] * opacity,
          packSlot(slot + 1, canvas ? GLYPH_MODE_R8 : GLYPH_MODE_MSDF),
          group.synthetic.bold ? SYNTH_BOLD_AMOUNT : 0,
          group.synthetic.italic ? Math.tan(SYNTHETIC_ITALIC_RADIANS) : 0,
        );
      }
    }
    close();
    return layer;
  }

  private upload(out: InstanceWriter, atlases: AtlasUse[]): Span {
    const gpu = this.gpu;
    this.corners ??= gpu.createBuffer('vertex', new Float32Array([0, 1, 2, 3]), 'static');
    this.indices ??= gpu.createBuffer('index', new Uint16Array([0, 1, 2, 0, 2, 3]), 'static');
    const buffer = gpu.createBuffer('vertex', out.data.subarray(0, out.count * GLYPH_INSTANCE_FLOATS), 'static');
    const vec4 = (location: number, at: number) => ({ location, components: 4 as const, offset: at * 16 });
    const geometry = gpu.createGeometry({
      vertexBuffers: [
        { buffer: this.corners, stride: 4, attributes: [{ location: L.a_corner, components: 1, offset: 0 }] },
        {
          buffer, stride: GLYPH_INSTANCE_FLOATS * 4, step: 'instance',
          attributes: [vec4(L.a_rect, 0), vec4(L.a_uvRect, 1), vec4(L.a_pen, 2), vec4(L.a_color, 3), vec4(L.a_glyph, 4)],
        },
      ],
      indexBuffer: this.indices, indexFormat: 'uint16',
    });
    return { buffer, geometry, count: out.count, atlases };
  }
}

function withFallback(layer: Layer): Layer {
  layer.fallback = true;
  return layer;
}

function textureReady(ctx: DrawContext, group: AtlasUse['group']): boolean {
  return group.source === 'canvas'
    ? syncDynamicPageTexture(ctx.textureCache, group.page)
    : ensureFontTexture(group.family, group.weight, group.style, ctx.textureCache);
}

/** Record how a group's glyphs map texture to layer, from its first quad as `areaGrowth` reads it, once a mapping. */
function addProbe(probes: AreaProbe[], fieldScale: readonly [number, number], quads: ArrayLike<number>): void {
  const perU = (quads[2] - quads[0]) / Math.abs(quads[6] - quads[4]);
  const perV = (quads[3] - quads[1]) / Math.abs(quads[7] - quads[5]);
  for (const p of probes) {
    if (p.perU === perU && p.perV === perV && p.fieldScale[0] === fieldScale[0] && p.fieldScale[1] === fieldScale[1]) return;
  }
  probes.push({ fieldScale, perU, perV });
}

/** A growing buffer of glyph instances (`shaders/glyphLayer.ts`). */
class InstanceWriter {
  data = new Float32Array(GLYPH_INSTANCE_FLOATS * 256);
  count = 0;

  group(
    quads: ArrayLike<number>, ox: number, oy: number, r: number, g: number, b: number, a: number,
    packed: number, bold: number, tanItalic: number,
  ): void {
    const n = quads.length / QUAD_STRIDE;
    this.reserve(this.count + n);
    let i = this.count * GLYPH_INSTANCE_FLOATS;
    const d = this.data;
    for (let at = 0; at < quads.length; at += QUAD_STRIDE) {
      const [cos, sin] = glyphTurn(quads[at + 10]);
      d[i] = quads[at] + ox; d[i + 1] = quads[at + 1] + oy; d[i + 2] = quads[at + 2] + ox; d[i + 3] = quads[at + 3] + oy;
      d[i + 4] = quads[at + 4]; d[i + 5] = quads[at + 5]; d[i + 6] = quads[at + 6]; d[i + 7] = quads[at + 7];
      d[i + 8] = quads[at + 8] + oy; d[i + 9] = quads[at + 9] + ox; d[i + 10] = cos; d[i + 11] = sin;
      d[i + 12] = r; d[i + 13] = g; d[i + 14] = b; d[i + 15] = a;
      d[i + 16] = packed; d[i + 17] = bold; d[i + 18] = tanItalic; d[i + 19] = 0;
      i += GLYPH_INSTANCE_FLOATS;
    }
    this.count += n;
  }

  private reserve(instances: number): void {
    if (instances * GLYPH_INSTANCE_FLOATS <= this.data.length) return;
    let size = this.data.length;
    while (size < instances * GLYPH_INSTANCE_FLOATS) size *= 2;
    const grown = new Float32Array(size);
    grown.set(this.data.subarray(0, this.count * GLYPH_INSTANCE_FLOATS));
    this.data = grown;
  }
}

/** `u_fieldScale` for a span; slots it gives no atlas keep whatever a previous draw wrote, which nothing reads. */
const FIELD_SCALES = new Float32Array(2 * BATCH_TEXTURE_SLOTS);
const MODEL = new Float64Array(9);

export function drawTextLayer(ctx: DrawContext, cmd: TextLayerDrawCommand): void {
  const layers = ctx.textLayers;
  if (layers === undefined || ctx.glyphLayerProgram === undefined || !drawLayer(ctx, layers.layerFor(ctx, cmd.texts))) {
    for (const text of cmd.texts) drawText(ctx, text);
  }
}

/** Draw `layer`, or say it cannot be drawn this frame. */
function drawLayer(ctx: DrawContext, layer: Layer): boolean {
  if (layer.fallback) return false;
  const m = ctx.state.transform;
  const minScreen = ctx.textOutlineMinScreenSize ?? OUTLINE_MIN_SCREEN_PX;
  if (Number.isFinite(minScreen) && layer.outlineSize >= minScreen / modelScale(m)) return false;
  for (const span of layer.spans) {
    for (const a of span.atlases) if (!textureReady(ctx, a.group)) return false;
  }
  if (layer.spans.length === 0) return true;

  const dpr = (ctx.deviceWidth ?? ctx.widthCss) / (ctx.widthCss || 1);
  const sx = Math.hypot(m[0], m[1]), sy = Math.hypot(m[3], m[4]);
  const area = layer.probes.some((p) => glyphNeedsArea(p.fieldScale, sx * dpr * p.perU, sy * dpr * p.perV));
  flushForOwnDraw(ctx);
  const prog = ctx.glyphLayerProgram!(area);
  const [ox, oy] = layer.origin;
  MODEL.set(m);
  MODEL[6] = m[0] * ox + m[3] * oy + m[6];
  MODEL[7] = m[1] * ox + m[4] * oy + m[7];
  setProjAndModel(ctx, prog, MODEL);
  setColorUniform(ctx, prog, 1, 1, 1, 1);
  uploadBatchMatrices(ctx, prog, [{ colorMatrix: ctx.state.colorMatrix, alpha: ctx.state.alpha }]);
  prog.set1f('u_devicePx', dpr);
  const stencil = clipTest(ctx.clipDepth);
  for (const span of layer.spans) {
    prog.setTexture('u_samplers', ctx.whiteTexture, 0);
    for (let s = 1; s < BATCH_TEXTURE_SLOTS; s++) {
      const a = span.atlases[s - 1];
      prog.setTexture('u_samplers', a ? ctx.textureCache.texture(a.id) : null, s);
      if (a) { FIELD_SCALES[2 * s] = a.fieldScale[0]; FIELD_SCALES[2 * s + 1] = a.fieldScale[1]; }
    }
    prog.set('u_fieldScale', 'vec2', FIELD_SCALES);
    drawTriangles(ctx, prog, span.geometry, 6, { stencil, instances: span.count });
  }
  return true;
}
