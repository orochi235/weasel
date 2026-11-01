import type { FaceEmbedding, FontStyle } from '@weasel-js/font';
import { name, type PdfName, type PdfObjects, type PdfRef, text } from '../objects';
import type { PdfFontSource } from './fontSource';
import { glyphCount, subsetTrueType } from './subset';
import { toUnicodeCMap } from './toUnicode';

export interface EmbeddedFont {
  /** The font object; throws until `use` has returned a glyph, so a page names only faces it draws with. */
  readonly ref: PdfRef;
  /** The code that draws `cp`'s glyph and reads back as `cp`, recorded for `/W` and `/ToUnicode`;
   *  `null` when the face has no glyph for it. */
  use(cp: number): number | null;
  /**
   * The code that draws glyph `gid`, which a shaper chose, and reads back as `text`: `''` for a
   * glyph that stands for no text of its own. With `width`, in 1000/em, the code moves the pen
   * that far rather than the glyph's own advance. Each reading and width of a glyph takes a
   * code of its own, mapped to it. Null for `.notdef`.
   */
  useGlyph(gid: number, text: string, width?: number): number | null;
  /** The text `/ToUnicode` reads code `code` back as: `''` for one that reads as nothing. */
  readsAs(code: number): string | undefined;
  /** A code's advance in 1000/em units. */
  widthOf(code: number): number;
  /** A glyph's advance in 1000/em units. */
  glyphWidth(gid: number): number;
}

const encoder = new TextEncoder();

/** The highest two-byte code. */
const MAX_CODE = 0xffff;

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
  /** Every glyph drawn, for the subset. */
  readonly used = new Set<number>();
  /** Code to the glyph it draws, the text it reads back as, and the width it moves the pen, when
   *  not the glyph's own. */
  private readonly codes = new Map<number, { gid: number; text: string; width: number | undefined }>();
  /** `gid|width|text` to its code. */
  private readonly codeOf = new Map<string, number>();
  /** The code the next reading of an already-coded glyph takes: past every glyph id, so a
   *  glyph's first reading can keep its own id as its code. */
  private spare: number;
  private fontRef: PdfRef | undefined;
  private written = false;

  constructor(
    private readonly objects: PdfObjects,
    private readonly emb: FaceEmbedding,
    private readonly baseFont: string,
    private readonly subset: boolean,
  ) {
    this.spare = glyphCount(emb.sfnt);
  }

  get ref(): PdfRef {
    if (!this.fontRef) throw new Error('pdf: font ref read before any glyph was used');
    return this.fontRef;
  }

  use(cp: number): number | null {
    const gid = this.emb.glyphIndexOf(cp);
    return gid === null ? null : this.useGlyph(gid, String.fromCodePoint(cp));
  }

  useGlyph(gid: number, text: string, width?: number): number | null {
    if (gid === 0) return null;
    if (width === this.glyphWidth(gid)) width = undefined;
    const key = `${gid}|${width ?? ''}|${text}`;
    let code = this.codeOf.get(key);
    if (code === undefined) {
      code = !this.codes.has(gid) ? gid : this.spare <= MAX_CODE ? this.spare++ : gid;
      if (!this.codes.has(code)) this.codes.set(code, { gid, text, width });
      this.codeOf.set(key, code);
    }
    this.used.add(gid);
    this.fontRef ??= this.objects.alloc();
    return code;
  }

  readsAs(code: number): string | undefined {
    return this.codes.get(code)?.text;
  }

  /** What `/ToUnicode` maps each code to. One that reads as nothing maps to a word joiner:
   *  invisible, and skipped by readers (pdf.js) that otherwise take an unmapped code for a
   *  code point. */
  private readings(): Map<number, string> {
    const out = new Map<number, string>();
    for (const [code, { text }] of this.codes) out.set(code, text || NOTHING);
    return out;
  }

  widthOf(code: number): number {
    const coded = this.codes.get(code);
    return coded?.width ?? this.glyphWidth(coded?.gid ?? code);
  }

  glyphWidth(gid: number): number {
    return Math.round((this.emb.advanceOfGlyph(gid) * 1000) / this.emb.unitsPerEm);
  }

  /** `/Identity` while every code is its own glyph id, else a stream mapping each code to its glyph. */
  private cidToGid(): PdfRef | PdfName {
    let top = -1;
    for (const [code, { gid }] of this.codes) if (code !== gid) top = Math.max(top, code);
    if (top < 0) return name('Identity');
    const map = new Uint8Array((top + 1) * 2);
    const view = new DataView(map.buffer);
    for (const [code, { gid }] of this.codes) if (code <= top) view.setUint16(code * 2, gid);
    const ref = this.objects.alloc();
    this.objects.streamDeflated(ref, {}, map);
    return ref;
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
    for (const code of [...this.codes.keys()].sort((a, b) => a - b)) widths.push(code, [this.widthOf(code)]);
    objects.set(cid, {
      Type: name('Font'),
      Subtype: name('CIDFontType2'),
      BaseFont: name(fontName),
      CIDSystemInfo: { Registry: text('Adobe'), Ordering: text('Identity'), Supplement: 0 },
      FontDescriptor: descriptor,
      CIDToGIDMap: this.cidToGid(),
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
