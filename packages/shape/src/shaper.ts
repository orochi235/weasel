/**
 * HarfBuzz, behind the shaping contract `@weasel-js/text` declares: font
 * bytes and text in, glyph indices with em-space advances and offsets out,
 * and the outline of any glyph a shaping produced.
 *
 * harfbuzzjs instantiates its WebAssembly when its module is evaluated, so it
 * is imported only by {@link loadShaper}: importing this package costs nothing
 * until a consumer asks for shaping.
 */
import { scriptPieces, type ScriptPiece } from './scripts';

type HarfBuzz = typeof import('harfbuzzjs');
type HbFont = InstanceType<HarfBuzz['Font']>;
type HbFeature = InstanceType<HarfBuzz['Feature']>;

/** One glyph a shaping produced. Every length is in ems of the face, and y
 *  grows downward. */
export interface ShapedGlyph {
  /** The glyph's index in the face. 0 is `.notdef`: the face has no glyph
   *  for its cluster. */
  gid: number;
  /** UTF-16 offset in the shaped text where its cluster starts. A cluster is
   *  the smallest stretch of text and glyphs that map onto each other: a
   *  ligature's cluster holds every character it joined. */
  cluster: number;
  /** How far the pen moves past it. */
  advance: number;
  /** Where it is drawn, from the pen. */
  dx: number;
  dy: number;
  /** Whether its piece of the text was shaped right to left, which also
   *  means HarfBuzz drew any mirrored character (a bracket) as its mirror. */
  rtl: boolean;
}

/** A shaping engine for weasel's text layout: what `registerShaper` takes. */
export interface Shaper {
  /**
   * Shape `text` set in the face whose font file is `face` (an sfnt: TrueType
   * or OpenType, not WOFF), with the OpenType `features` turned on.
   *
   * `language` is a BCP 47 tag (`'sr'`, `'ur'`) and selects the face's forms
   * for that language: Serbian Cyrillic italics, Urdu digits. Absent, the
   * face's default forms are drawn.
   *
   * Glyphs come in logical order: clusters by ascending `cluster`, and a
   * cluster's own glyphs in the order they are drawn, left to right. The array
   * is shared with later calls asking the same; never mutate it.
   */
  shape(face: ArrayBuffer, text: string, features?: readonly string[], language?: string): readonly ShapedGlyph[];
  /** Em-space SVG path data for glyph `gid` of `face`, moved by `(dx, dy)`
   *  ems; y grows downward and the origin is the pen on the baseline. Null for
   *  a glyph with no contours. */
  glyphD(face: ArrayBuffer, gid: number, dx?: number, dy?: number): string | null;
  /** Whether `face` has the OpenType feature `tag` (`'smcp'`, `'liga'`) in its
   *  substitutions or positioning. */
  hasFeature(face: ArrayBuffer, tag: string): boolean;
}

/** Path commands in font units, y up, as HarfBuzz draws them. */
interface Command { type: string; values: number[] }

interface FaceRecord {
  font: HbFont;
  upem: number;
  features: ReadonlySet<string>;
  paths: Map<number, readonly Command[]>;
  shapes: Map<string, readonly ShapedGlyph[]>;
}

/** Shapings held per face before they are dropped together. */
const SHAPE_CACHE_LIMIT = 512;

/** Decimal places kept in path data: 1e-5 em, and never exponent notation,
 *  which an SVG path tokenizer would read as a command. */
const PRECISION = 1e5;

const fmt = (v: number): string => String(Math.round(v * PRECISION) / PRECISION);

class HarfBuzzShaper implements Shaper {
  readonly #hb: HarfBuzz;
  readonly #faces = new WeakMap<ArrayBuffer, FaceRecord>();
  readonly #features = new Map<string, HbFeature>();

  constructor(hb: HarfBuzz) {
    this.#hb = hb;
  }

  #face(bytes: ArrayBuffer): FaceRecord {
    let rec = this.#faces.get(bytes);
    if (rec) return rec;
    const hb = this.#hb;
    const face = new hb.Face(new hb.Blob(bytes));
    rec = {
      font: new hb.Font(face),
      upem: face.upem,
      features: new Set([...face.getTableFeatureTags('GSUB'), ...face.getTableFeatureTags('GPOS')]),
      paths: new Map(),
      shapes: new Map(),
    };
    this.#faces.set(bytes, rec);
    return rec;
  }

  #feature(tag: string): HbFeature {
    let f = this.#features.get(tag);
    if (!f) {
      const parsed = this.#hb.Feature.fromString(tag);
      if (!parsed) throw new Error(`weasel shape: "${tag}" is not an OpenType feature setting`);
      f = parsed;
      this.#features.set(tag, f);
    }
    return f;
  }

  shape(
    bytes: ArrayBuffer, text: string, features: readonly string[] = [], language?: string,
  ): readonly ShapedGlyph[] {
    const rec = this.#face(bytes);
    const lang = language || undefined;
    const key = `${features.join(',')}\u0000${lang ?? ''}\u0000${text}`;
    const held = rec.shapes.get(key);
    if (held) return held;
    const hbFeatures = features.map((tag) => this.#feature(tag));
    const out: ShapedGlyph[] = [];
    for (const piece of scriptPieces(text)) this.#piece(rec, text, piece, hbFeatures, lang, out);
    if (rec.shapes.size >= SHAPE_CACHE_LIMIT) rec.shapes.clear();
    rec.shapes.set(key, out);
    return out;
  }

  /** Shape `piece` of `text`, the rest of `text` around it as context, and
   *  append its glyphs to `out` in logical order. */
  #piece(
    rec: FaceRecord, text: string, piece: ScriptPiece, features: HbFeature[], lang: string | undefined,
    out: ShapedGlyph[],
  ): void {
    const hb = this.#hb;
    const { start, end, rtl } = piece;
    const buffer = new hb.Buffer();
    buffer.addText(text, start, end - start);
    buffer.setDirection(rtl ? hb.Direction.RTL : hb.Direction.LTR);
    if (lang !== undefined) buffer.setLanguage(lang);
    // Fills in the script, and the language when none was set; what was set stands.
    buffer.guessSegmentProperties();
    // Marks keep clusters of their own, so each lands in the slot of the
    // character it was written as rather than merging into its base's.
    buffer.setClusterLevel(hb.ClusterLevel.MONOTONE_CHARACTERS);
    hb.shape(rec.font, buffer, features);
    const infos = buffer.getGlyphInfos();
    const positions = buffer.getGlyphPositions();
    const em = rec.upem;
    const glyphs: ShapedGlyph[] = infos.map((info, i) => ({
      gid: info.codepoint,
      cluster: info.cluster,
      advance: positions[i].xAdvance / em,
      dx: positions[i].xOffset / em,
      dy: -positions[i].yOffset / em,
      rtl,
    }));
    if (!rtl) {
      for (const g of glyphs) out.push(g);
      return;
    }
    // Right to left, HarfBuzz hands the glyphs over in visual order. Reverse
    // the clusters into logical order and keep each one's own glyphs as drawn.
    let hi = glyphs.length;
    while (hi > 0) {
      let lo = hi - 1;
      while (lo > 0 && glyphs[lo - 1].cluster === glyphs[hi - 1].cluster) lo--;
      for (let k = lo; k < hi; k++) out.push(glyphs[k]);
      hi = lo;
    }
  }

  glyphD(bytes: ArrayBuffer, gid: number, dx = 0, dy = 0): string | null {
    const rec = this.#face(bytes);
    let cmds = rec.paths.get(gid);
    if (cmds === undefined) {
      cmds = rec.font.glyphToJson(gid) as readonly Command[];
      rec.paths.set(gid, cmds);
    }
    if (cmds.length === 0) return null;
    const em = rec.upem;
    let d = '';
    for (const { type, values } of cmds) {
      d += type;
      for (let k = 0; k < values.length; k += 2) {
        d += `${k === 0 ? '' : ' '}${fmt(values[k] / em + dx)} ${fmt(-values[k + 1] / em + dy)}`;
      }
    }
    return d;
  }

  hasFeature(bytes: ArrayBuffer, tag: string): boolean {
    return this.#face(bytes).features.has(tag);
  }
}

let loading: Promise<Shaper> | null = null;

/**
 * Load HarfBuzz (about 450 kB of WebAssembly) and resolve with a shaper over
 * it. Once per process: every call answers the same shaper.
 *
 * ```ts
 * import { loadShaper } from '@weasel-js/shape';
 * import { registerShaper } from '@weasel-js/core';
 *
 * registerShaper(await loadShaper());
 * ```
 */
export function loadShaper(): Promise<Shaper> {
  loading ??= import('harfbuzzjs').then((hb) => new HarfBuzzShaper(hb));
  return loading;
}
