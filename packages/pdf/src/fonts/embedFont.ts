import type { FaceEmbedding, FontStyle } from '@weasel-js/font';
import { name, type PdfObjects, type PdfRef, text } from '../objects';
import type { PdfFontSource } from './fontSource';
import { subsetTrueType } from './subset';
import { toUnicodeCMap } from './toUnicode';

export interface EmbeddedFont {
  /** The font object; throws until `use` has returned a glyph, so a page names only faces it draws with. */
  readonly ref: PdfRef;
  /** The glyph id for `cp`, recorded for `/W` and `/ToUnicode`; `null` when the face has no glyph for it. */
  use(cp: number): number | null;
  /**
   * Records glyph `gid`, which a shaper chose, for `/W`, and for `/ToUnicode` as standing for
   * `text` unless an earlier use claimed it; without `text` it stands for nothing new. False
   * for `.notdef`.
   */
  useGlyph(gid: number, text?: string): boolean;
  /** The text `/ToUnicode` reads glyph `gid` back as, so far. */
  readsAs(gid: number): string | undefined;
  /** A glyph's advance in 1000/em units. */
  widthOf(gid: number): number;
}

const encoder = new TextEncoder();

/** U+2060 WORD JOINER: format character, no width, no break. */
const NOTHING = '\u2060';

function baseFontName(e: FaceEmbedding, family: string, weight: number, style: FontStyle): string {
  const safe = (s: string) => s.replace(/[^A-Za-z0-9._-]/g, '');
  return safe(e.postScriptName) || safe(`${family}-${weight}-${style}`);
}

/** Six capitals naming a subset, as ISO 32000 9.6.4 asks; the same glyphs always get the same tag. */
function subsetTag(gids: Iterable<number>): string {
  let h = 0x811c9dc5;
  for (const gid of [...gids].sort((a, b) => a - b)) h = Math.imul(h ^ gid, 0x01000193) >>> 0;
  let tag = '';
  for (let i = 0; i < 6; i++, h = Math.floor(h / 26)) tag += String.fromCharCode(65 + (h % 26));
  return tag;
}

class Face implements EmbeddedFont {
  /** Every glyph drawn, for `/W` and the subset. */
  readonly used = new Set<number>();
  /** Glyph id to the first text it was drawn for. */
  readonly unicode = new Map<number, string>();
  private fontRef: PdfRef | undefined;
  private written = false;

  constructor(
    private readonly objects: PdfObjects,
    private readonly emb: FaceEmbedding,
    private readonly baseFont: string,
    private readonly subset: boolean,
  ) {}

  get ref(): PdfRef {
    if (!this.fontRef) throw new Error('pdf: font ref read before any glyph was used');
    return this.fontRef;
  }

  use(cp: number): number | null {
    const gid = this.emb.glyphIndexOf(cp);
    return gid !== null && this.useGlyph(gid, String.fromCodePoint(cp)) ? gid : null;
  }

  useGlyph(gid: number, text?: string): boolean {
    if (gid === 0) return false;
    this.used.add(gid);
    if (text !== undefined && !this.unicode.has(gid)) this.unicode.set(gid, text);
    this.fontRef ??= this.objects.alloc();
    return true;
  }

  readsAs(gid: number): string | undefined {
    return this.unicode.get(gid);
  }

  /** What `/ToUnicode` maps each glyph to. A glyph standing for no text of its own (a cluster's
   *  second glyph, always under `/ActualText`) reads as a word joiner: invisible, and skipped by
   *  readers that ignore `/ActualText` (pdf.js), which otherwise take its glyph id for a code point. */
  private readings(): Map<number, string> {
    const out = new Map(this.unicode);
    for (const gid of this.used) if (!out.has(gid)) out.set(gid, NOTHING);
    return out;
  }

  widthOf(gid: number): number {
    return Math.round((this.emb.advanceOfGlyph(gid) * 1000) / this.emb.unitsPerEm);
  }

  write(): void {
    if (this.written || !this.fontRef) return;
    this.written = true;
    const { objects, emb } = this;
    const k = 1000 / emb.unitsPerEm;
    const file = objects.alloc();
    const descriptor = objects.alloc();
    const cid = objects.alloc();
    const toUnicode = objects.alloc();
    const program = this.subset ? subsetTrueType(emb.sfnt, this.used) : new Uint8Array(emb.sfnt);
    const fontName = this.subset ? `${subsetTag(this.used)}+${this.baseFont}` : this.baseFont;
    objects.streamDeflated(file, { Length1: program.byteLength }, program);
    objects.streamDeflated(toUnicode, {}, encoder.encode(toUnicodeCMap(this.readings())));
    objects.set(descriptor, {
      Type: name('FontDescriptor'),
      FontName: name(fontName),
      Flags: 4,
      FontBBox: emb.bbox.map((v, i) => (i < 2 ? Math.floor(v * k) : Math.ceil(v * k))),
      ItalicAngle: emb.italicAngle,
      Ascent: Math.round(emb.ascent * k),
      Descent: Math.round(emb.descent * k),
      CapHeight: Math.round(emb.capHeight * k),
      StemV: 80, // required by the spec, advisory for TrueType
      FontFile2: file,
    });
    const widths: (number | number[])[] = [];
    for (const gid of [...this.used].sort((a, b) => a - b)) widths.push(gid, [this.widthOf(gid)]);
    objects.set(cid, {
      Type: name('Font'),
      Subtype: name('CIDFontType2'),
      BaseFont: name(fontName),
      CIDSystemInfo: { Registry: text('Adobe'), Ordering: text('Identity'), Supplement: 0 },
      FontDescriptor: descriptor,
      CIDToGIDMap: name('Identity'),
      W: widths,
    });
    objects.set(this.fontRef, {
      Type: name('Font'),
      Subtype: name('Type0'),
      BaseFont: name(fontName),
      Encoding: name('Identity-H'),
      DescendantFonts: [cid],
      ToUnicode: toUnicode,
    });
  }
}

/** One document's embedded fonts: each face is written once, its program, `/W` and `/ToUnicode` covering the glyphs used. */
export class DocumentFonts {
  private readonly faces = new Map<string, Promise<Face | null>>();

  constructor(
    private readonly objects: PdfObjects,
    private readonly source: PdfFontSource,
    /** False embeds each face whole. */
    private readonly subset = true,
  ) {}

  /** The embedded font for a face, or null to draw its glyphs as outlines. */
  face(family: string, weight: number, style: FontStyle): Promise<EmbeddedFont | null> {
    const key = JSON.stringify([family, weight, style]);
    let p = this.faces.get(key);
    if (!p) {
      p = this.load(family, weight, style);
      this.faces.set(key, p);
    }
    return p;
  }

  private async load(family: string, weight: number, style: FontStyle): Promise<Face | null> {
    let emb: FaceEmbedding | null;
    try {
      emb = await this.source.embedding(family, weight, style);
    } catch {
      return null;
    }
    if (!emb || emb.outlines !== 'truetype' || !emb.embeddable) return null;
    return new Face(this.objects, emb, baseFontName(emb, family, weight, style), this.subset);
  }

  /** Writes every face's objects; call before `PdfObjects.settle`. */
  async finish(): Promise<void> {
    for (const p of this.faces.values()) (await p)?.write();
  }
}
