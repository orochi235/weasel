import type { FaceEmbedding, FontStyle } from '@weasel-js/font';
import { name, type PdfObjects, type PdfRef, text } from '../objects';
import type { PdfFontSource } from './fontSource';
import { toUnicodeCMap } from './toUnicode';

export interface EmbeddedFont {
  ref: PdfRef;
  /** The glyph id for `cp`, recorded for `/W` and `/ToUnicode`; `null` when the face has no glyph for it. */
  use(cp: number): number | null;
  /** A glyph's advance in 1000/em units. */
  widthOf(gid: number): number;
}

const encoder = new TextEncoder();

function baseFontName(e: FaceEmbedding, family: string, weight: number, style: FontStyle): string {
  const safe = (s: string) => s.replace(/[^A-Za-z0-9._-]/g, '');
  return safe(e.postScriptName) || safe(`${family}-${weight}-${style}`);
}

class Face implements EmbeddedFont {
  readonly ref: PdfRef;
  /** Glyph id to the first codepoint that asked for it. */
  readonly used = new Map<number, number>();

  constructor(
    private readonly objects: PdfObjects,
    private readonly emb: FaceEmbedding,
    private readonly baseFont: string,
  ) {
    this.ref = objects.alloc();
  }

  use(cp: number): number | null {
    const gid = this.emb.glyphIndexOf(cp);
    if (gid === null || gid === 0) return null;
    if (!this.used.has(gid)) this.used.set(gid, cp);
    return gid;
  }

  widthOf(gid: number): number {
    return Math.round((this.emb.advanceOfGlyph(gid) * 1000) / this.emb.unitsPerEm);
  }

  write(): void {
    const { objects, emb } = this;
    const k = 1000 / emb.unitsPerEm;
    const file = objects.alloc();
    const descriptor = objects.alloc();
    const cid = objects.alloc();
    const toUnicode = objects.alloc();
    objects.streamDeflated(file, { Length1: emb.sfnt.byteLength }, new Uint8Array(emb.sfnt));
    objects.streamDeflated(toUnicode, {}, encoder.encode(toUnicodeCMap(this.used)));
    objects.set(descriptor, {
      Type: name('FontDescriptor'),
      FontName: name(this.baseFont),
      Flags: 4,
      FontBBox: emb.bbox.map((v) => Math.round(v * k)),
      ItalicAngle: emb.italicAngle,
      Ascent: Math.round(emb.ascent * k),
      Descent: Math.round(emb.descent * k),
      CapHeight: Math.round(emb.capHeight * k),
      StemV: 80,
      FontFile2: file,
    });
    const widths: (number | number[])[] = [];
    for (const gid of [...this.used.keys()].sort((a, b) => a - b)) widths.push(gid, [this.widthOf(gid)]);
    objects.set(cid, {
      Type: name('Font'),
      Subtype: name('CIDFontType2'),
      BaseFont: name(this.baseFont),
      CIDSystemInfo: { Registry: text('Adobe'), Ordering: text('Identity'), Supplement: 0 },
      FontDescriptor: descriptor,
      CIDToGIDMap: name('Identity'),
      W: widths,
    });
    objects.set(this.ref, {
      Type: name('Font'),
      Subtype: name('Type0'),
      BaseFont: name(this.baseFont),
      Encoding: name('Identity-H'),
      DescendantFonts: [cid],
      ToUnicode: toUnicode,
    });
  }
}

/** One document's embedded fonts: each face is written once, with `/W` and `/ToUnicode` covering the glyphs used. */
export class DocumentFonts {
  private readonly faces = new Map<string, Promise<Face | null>>();

  constructor(
    private readonly objects: PdfObjects,
    private readonly source: PdfFontSource,
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
    const emb = await this.source.embedding(family, weight, style);
    if (!emb || emb.outlines !== 'truetype' || !emb.embeddable) return null;
    return new Face(this.objects, emb, baseFontName(emb, family, weight, style));
  }

  /** Writes every face's objects; call before `PdfObjects.settle`. */
  async finish(): Promise<void> {
    for (const p of this.faces.values()) (await p)?.write();
  }
}
