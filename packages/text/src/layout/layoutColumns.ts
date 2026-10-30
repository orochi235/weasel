/**
 * A layout's code points held in columns: one array of numbers and one of
 * references for the whole text, rather than a cell object and a placed-glyph
 * object per code point with every number in them boxed.
 *
 * The numbers sit in a plain array rather than a typed one on purpose: V8
 * keeps an all-number array's elements unboxed in one object on its own heap,
 * where a typed array costs a backing store allocated outside it, and a label
 * re-laid out every frame would pay for one every frame.
 *
 * A layout's `cells` and `glyphs` are views onto these, built the first time
 * something reads them. The renderer's paint path never does: `paintRuns`
 * reads the columns through one reused {@link PlacedGlyph}.
 *
 * A code point's cell and its placed glyph share their pen position, width
 * and code point, so each is stored once.
 */
import type { BmFont, BmFontChar, GlyphMetrics, ResolveResult } from '@weasel-js/font';
import type { Entry } from './layoutEntries';
import type { LaidOutCell, LaidOutLineBox, PlacedGlyph } from './layoutRuns';
import type { ShapedCluster } from './shaperSeam';
import { giveDoubles, giveRefs, takeDoubles, takeRefs, truncate } from './arrayPool';

/** Numbers per code point: pen x, step, the glyph's own advance, its size,
 *  its baseline, its source span, code point, bidi level, the two flags, its
 *  run, the logical index of the glyph at this visual slot, and its turn. */
const NUM = 13;
const X = 0, STEP = 1, ADVANCE = 2, FONT_SIZE = 3, BASELINE = 4;
const SRC_INDEX = 5, SRC_END = 6, CP = 7, LEVEL = 8, FLAGS = 9, RUN = 10, VISUAL = 11, ROTATE = 12;
const DRAWS_INK = 1, CLUSTER_END = 2;
/** References per code point: the serving tier, its metrics, the atlas, the
 *  glyph's record there, and what a shaper gave it. */
const REF = 5;

const EMPTY_NUM: number[] = [];
const EMPTY_REF: unknown[] = [];

/** Recycled columns, for {@link LayoutColumns.take}. Sized for a frame of
 *  HUD labels, each of which recycles its last frame's layout. */
const spare: LayoutColumns[] = [];
const SPARE_MAX = 1024;

/** Every code point of one layout. Index `i` is a code point's place in the
 *  text, in logical order, newlines left out. */
export class LayoutColumns {
  num: number[];
  ref: unknown[];
  /** The layout's line boxes, its `lines`. A recycled layout's are refilled
   *  by the next layout to take its columns. */
  readonly boxes: LineBox[] = [];
  /** The layout's `bounds`, refilled like its boxes. */
  readonly bounds = { width: 0.5, height: 0.5 };
  /** The paint cache's paintings of this layout, kept here rather than in a
   *  map keyed by the layout, so that recycling one deletes no map entry. */
  readonly paintings: unknown[] = [];
  /** The layout cache's record of who can still reach this layout: runs
   *  arrays it is filed under, whether its structural list holds it, and
   *  whether any caller was handed it to keep. Only a layout with none of the
   *  three gives its arrays back. */
  owners = 0;
  listed = false;
  pinned = false;

  private constructor(size: number) {
    this.num = takeDoubles(size * NUM);
    this.ref = takeRefs(size * REF);
  }

  /** Columns for `size` code points: a recycled layout's, refilled, when the
   *  pool holds one. */
  static take(size: number): LayoutColumns {
    const cols = spare.pop();
    if (cols === undefined) return new LayoutColumns(size);
    cols.num = takeDoubles(size * NUM);
    cols.ref = takeRefs(size * REF);
    return cols;
  }

  /** Give the arrays back to the pool, and these columns with their line
   *  boxes to the next layout. A line box still held afterwards reads that
   *  layout's code points, so only a layout nobody holds is recycled. */
  recycle(): void {
    giveDoubles(this.num);
    // A loop, not `fill`, which Chromium's allocation profile charged 400 bytes a call.
    const { ref } = this;
    for (let i = 0; i < ref.length; i++) ref[i] = undefined;
    giveRefs(ref);
    this.num = EMPTY_NUM;
    this.ref = EMPTY_REF;
    truncate(this.paintings, 0);
    this.owners = 0;
    this.listed = false;
    this.pinned = false;
    if (spare.length < SPARE_MAX) spare.push(this);
  }

  /** Store code point `i`: entry `e`, set at `x` on a baseline at `baselineY`,
   *  moving the pen `step`. */
  set(i: number, e: Entry, level: number, x: number, step: number, baselineY: number): void {
    const n = i * NUM, r = i * REF;
    const { num, ref } = this;
    num[n + X] = x; num[n + STEP] = step; num[n + ADVANCE] = e.advance;
    num[n + FONT_SIZE] = e.fontSize; num[n + BASELINE] = baselineY;
    num[n + SRC_INDEX] = e.srcIndex; num[n + SRC_END] = e.srcEnd; num[n + CP] = e.cp;
    num[n + LEVEL] = level; num[n + RUN] = e.run; num[n + ROTATE] = e.rotate;
    num[n + FLAGS] = (e.drawsInk ? DRAWS_INK : 0) | (e.clusterEnd ? CLUSTER_END : 0);
    ref[r] = e.resolved; ref[r + 1] = e.metrics; ref[r + 2] = e.font; ref[r + 3] = e.glyph;
    ref[r + 4] = e.shaped;
  }

  /** Lengthen code point `i`'s step by `by`: the kerning the pen takes after it. */
  widen(i: number, by: number): void {
    this.num[i * NUM + STEP] += by;
  }

  /** Record that the `slot`-th code point the pen reaches on the line starting
   *  at `start` is the line's `pos`-th in logical order. */
  setVisual(start: number, slot: number, pos: number): void {
    this.num[(start + slot) * NUM + VISUAL] = pos;
  }

  /** Logical index, within its line, of the glyph at visual `slot`. */
  visual(start: number, slot: number): number {
    return this.num[(start + slot) * NUM + VISUAL];
  }

  /** Fill `out` with code point `start + pos`'s placed glyph and return it.
   *  Every field is overwritten, so one object can walk a whole layout. */
  glyph(start: number, pos: number, out: PlacedGlyph): PlacedGlyph {
    const i = start + pos;
    const n = i * NUM, r = i * REF;
    const { num, ref } = this;
    out.run = num[n + RUN];
    out.cell = pos;
    out.cp = num[n + CP];
    out.fontSize = num[n + FONT_SIZE];
    out.resolved = ref[r] as ResolveResult;
    out.metrics = ref[r + 1] as GlyphMetrics;
    out.font = ref[r + 2] as BmFont | null;
    out.glyph = ref[r + 3] as BmFontChar | null;
    out.shaped = ref[r + 4] as ShapedCluster | null;
    out.x = num[n + X];
    out.baselineY = num[n + BASELINE];
    out.advance = num[n + ADVANCE];
    out.step = num[n + STEP];
    out.rotate = num[n + ROTATE];
    return out;
  }

  /** Code point `start + pos`'s `LaidOutCell.drawsInk`, without building the cell. */
  drawsInk(start: number, pos: number): boolean {
    return (this.num[(start + pos) * NUM + FLAGS] & DRAWS_INK) !== 0;
  }

  /** Code point `start + pos`'s cell, as a new object. */
  cell(start: number, pos: number): LaidOutCell {
    const n = (start + pos) * NUM;
    const { num } = this;
    const flags = num[n + FLAGS];
    return {
      srcIndex: num[n + SRC_INDEX], srcEnd: num[n + SRC_END], cp: num[n + CP],
      x: num[n + X], advance: num[n + STEP], level: num[n + LEVEL],
      drawsInk: (flags & DRAWS_INK) !== 0, clusterEnd: (flags & CLUSTER_END) !== 0,
    };
  }
}

/** A placed glyph to fill with {@link LayoutColumns.glyph}, its fields set to
 *  their final kinds so that refilling it never changes its shape. */
export function blankGlyph(): PlacedGlyph {
  return {
    run: 0, cell: 0, cp: 0, fontSize: 0.5,
    resolved: null as unknown as ResolveResult, metrics: null as unknown as GlyphMetrics,
    font: null, glyph: null, shaped: null, x: 0.5, baselineY: 0.5, advance: 0.5, step: 0.5, rotate: 0.5,
  };
}

/**
 * A line box whose `cells` and `glyphs` are code points `[start, start +
 * count)` of `cols`, built on first read and kept. They are own enumerable
 * properties, so a spread, a clone or a deep equality sees them as it would
 * plain fields.
 */
export class LineBox implements LaidOutLineBox {
  declare readonly cells: LaidOutCell[];
  declare readonly glyphs: PlacedGlyph[];
  // Declared rather than defined: a defined field starts out undefined, which
  // left V8 boxing every number `refill` writes to it.
  declare x0: number; declare y0: number; declare x1: number; declare y1: number;
  declare baselineY: number;
  declare srcEnd: number;
  declare justified: boolean;
  readonly #cols: LayoutColumns;
  #start: number;
  #count: number;
  /** Whether a view was built, replacing its accessor with a value. */
  #viewed = false;

  constructor(
    x0: number, y0: number, x1: number, y1: number, baselineY: number, srcEnd: number, justified: boolean,
    cols: LayoutColumns, start: number, count: number,
  ) {
    this.x0 = x0; this.y0 = y0; this.x1 = x1; this.y1 = y1;
    this.baselineY = baselineY; this.srcEnd = srcEnd; this.justified = justified;
    this.#cols = cols; this.#start = start; this.#count = count;
    Object.defineProperties(this, LineBox.#views);
  }

  /** Set this box to another line of the same columns, as the constructor
   *  would, its views unbuilt again. */
  refill(
    x0: number, y0: number, x1: number, y1: number, baselineY: number, srcEnd: number, justified: boolean,
    start: number, count: number,
  ): this {
    this.x0 = x0; this.y0 = y0; this.x1 = x1; this.y1 = y1;
    this.baselineY = baselineY; this.srcEnd = srcEnd; this.justified = justified;
    this.#start = start; this.#count = count;
    if (this.#viewed) {
      this.#viewed = false;
      Object.defineProperties(this, LineBox.#views);
    }
    return this;
  }

  /** The columns a line reads; null for a line built by hand. */
  static columns(line: LaidOutLineBox): LayoutColumns | null {
    return line instanceof LineBox ? line.#cols : null;
  }

  /** Where a line built by layout starts in its columns; 0 for one built by hand. */
  static start(line: LaidOutLineBox): number {
    return line instanceof LineBox ? line.#start : 0;
  }

  /** How many code points the line holds, without building a view. */
  static count(line: LaidOutLineBox): number {
    return line instanceof LineBox ? line.#count : line.glyphs.length;
  }

  static #views: PropertyDescriptorMap = {
    cells: lazy('cells', (l: LineBox) => {
      l.#viewed = true;
      const out: LaidOutCell[] = new Array(l.#count);
      for (let pos = 0; pos < l.#count; pos++) out[pos] = l.#cols.cell(l.#start, pos);
      return out;
    }),
    glyphs: lazy('glyphs', (l: LineBox) => {
      l.#viewed = true;
      const out: PlacedGlyph[] = new Array(l.#count);
      for (let slot = 0; slot < l.#count; slot++) {
        out[slot] = l.#cols.glyph(l.#start, l.#cols.visual(l.#start, slot), blankGlyph());
      }
      return out;
    }),
  };
}

/** An own property `key` that `build` computes on first read, then holds as
 *  a plain value. */
export function lazy<T extends object>(key: string, build: (self: T) => unknown): PropertyDescriptor {
  return {
    enumerable: true,
    configurable: true,
    get(this: T) {
      const value = build(this);
      Object.defineProperty(this, key, { value, enumerable: true, configurable: true, writable: false });
      return value;
    },
  };
}
