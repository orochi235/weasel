import { type FaceEmbedding, type OutlineVariant, registerFontOutlines, unregisterFontOutlines } from '@weasel-js/font';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { name, PdfObjects } from '../objects';
import { latin1 } from '../latin1';
import { DocumentFonts } from './embedFont';
import { type PdfFontSource, registryFontSource } from './fontSource';

const INTER_TTF = resolve(import.meta.dirname, '../../../../assets/fonts/inter/inter.ttf');

function interBytes(): ArrayBuffer {
  const buf = readFileSync(INTER_TTF);
  // Built in this test's realm: the registry's `instanceof ArrayBuffer` rejects Node's.
  const out = new ArrayBuffer(buf.byteLength);
  new Uint8Array(out).set(buf);
  return out;
}

const registered: [string, OutlineVariant][] = [];
function registerInter(family: string, variant: OutlineVariant = {}): void {
  registerFontOutlines(family, variant, interBytes());
  registered.push([family, variant]);
}
afterEach(() => {
  for (const [f, v] of registered.splice(0)) unregisterFontOutlines(f, v);
});

/** Settles and serializes everything the fonts wrote, as text. */
async function render(objects: PdfObjects, fonts: DocumentFonts): Promise<string> {
  await fonts.finish();
  const root = objects.alloc();
  objects.set(root, { Type: name('Catalog') });
  await objects.settle(false, async (d) => d);
  return latin1(objects.serialize(root));
}

function withEmbedding(patch: Partial<FaceEmbedding>): PdfFontSource {
  return {
    ...registryFontSource,
    embedding: async (family, weight, style) => {
      const e = await registryFontSource.embedding(family, weight, style);
      return e && { ...e, ...patch };
    },
  };
}

describe('DocumentFonts', () => {
  it('embeds a TrueType face whole as a Type0 font when told not to subset', async () => {
    registerInter('pdf-inter-whole');
    const objects = new PdfObjects();
    const fonts = new DocumentFonts(objects, registryFontSource, false);
    const font = (await fonts.face('pdf-inter-whole', 400, 'normal'))!;
    font.use(0x41);
    const s = await render(objects, fonts);
    expect(s).toContain('/Subtype /Type0');
    expect(s).toContain('/Encoding /Identity-H');
    expect(s).toContain('/Subtype /CIDFontType2');
    expect(s).toContain('/CIDToGIDMap /Identity');
    expect(s).toContain('/FontFile2');
    expect(s).toContain('/ToUnicode');
    const emb = (await registryFontSource.embedding('pdf-inter-whole', 400, 'normal'))!;
    expect(s).toContain(`/Length1 ${emb.sfnt.byteLength}`);
    expect(s).toMatch(new RegExp(`/Length ${emb.sfnt.byteLength}>>\\nstream\\n`));
  });

  it('embeds only the glyphs used, under a subset-tagged name', async () => {
    registerInter('pdf-inter-subset');
    const objects = new PdfObjects();
    const fonts = new DocumentFonts(objects, registryFontSource);
    const font = (await fonts.face('pdf-inter-subset', 400, 'normal'))!;
    font.use(0x41);
    const s = await render(objects, fonts);
    const emb = (await registryFontSource.embedding('pdf-inter-subset', 400, 'normal'))!;
    const length1 = Number(/\/Length1 (\d+)/.exec(s)![1]);
    expect(length1).toBeLessThan(emb.sfnt.byteLength / 8);
    expect(s).toContain('/CIDToGIDMap /Identity');
    const tagged = new RegExp(`/BaseFont /[A-Z]{6}\\+${emb.postScriptName}\\b`, 'g');
    expect(s.match(tagged)).toHaveLength(2);
    expect(s).toMatch(new RegExp(`/FontName /[A-Z]{6}\\+${emb.postScriptName}\\b`));
  });

  it('tags two subsets of one face differently, and one subset the same every time', async () => {
    registerInter('pdf-inter-tag');
    const tag = async (cps: number[]) => {
      const objects = new PdfObjects();
      const fonts = new DocumentFonts(objects, registryFontSource);
      const font = (await fonts.face('pdf-inter-tag', 400, 'normal'))!;
      for (const cp of cps) font.use(cp);
      return /\/BaseFont \/([A-Z]{6})\+/.exec(await render(objects, fonts))![1];
    };
    expect(await tag([0x41])).toBe(await tag([0x41]));
    expect(await tag([0x41])).not.toBe(await tag([0x42]));
  });

  it('maps every glyph used back to its character', async () => {
    registerInter('pdf-inter-map');
    const objects = new PdfObjects();
    const fonts = new DocumentFonts(objects, registryFontSource);
    const font = (await fonts.face('pdf-inter-map', 400, 'normal'))!;
    const gid = font.use(0x41)!;
    const hex = gid.toString(16).toUpperCase().padStart(4, '0');
    const s = await render(objects, fonts);
    expect(s).toContain(`<${hex}> <0041>`);
    expect(s).toContain('beginbfchar');
  });

  it('writes ToUnicode in blocks of at most 100 and astral codepoints as surrogate pairs', async () => {
    registerInter('pdf-inter-blocks');
    const objects = new PdfObjects();
    const source = withEmbedding({
      glyphIndexOf: (cp) => (cp >= 0x4e00 ? (cp % 0x10000) + 1 : null),
      advanceOfGlyph: () => 500,
    });
    const fonts = new DocumentFonts(objects, source);
    const font = (await fonts.face('pdf-inter-blocks', 400, 'normal'))!;
    for (let cp = 0x4e00; cp < 0x4e00 + 250; cp++) font.use(cp);
    font.use(0x1f600);
    const s = await render(objects, fonts);
    const blocks = [...s.matchAll(/(\d+) beginbfchar/g)].map((m) => Number(m[1]));
    expect(blocks.length).toBeGreaterThanOrEqual(3);
    expect(Math.max(...blocks)).toBeLessThanOrEqual(100);
    expect(blocks.reduce((a, b) => a + b, 0)).toBe(251);
    expect(s).toContain('<D83DDE00>');
  });

  it('writes widths only for glyphs used', async () => {
    registerInter('pdf-inter-w');
    const objects = new PdfObjects();
    const fonts = new DocumentFonts(objects, registryFontSource);
    const font = (await fonts.face('pdf-inter-w', 400, 'normal'))!;
    const gid = font.use(0x41)!;
    const emb = (await registryFontSource.embedding('pdf-inter-w', 400, 'normal'))!;
    const w = Math.round((emb.advanceOfGlyph(gid) * 1000) / emb.unitsPerEm);
    expect(font.widthOf(gid)).toBe(w);
    const s = await render(objects, fonts);
    expect(s).toContain(`/W [${gid} [${w}]]`);
  });

  it('answers null for a glyph the face lacks and never records glyph 0', async () => {
    registerInter('pdf-inter-miss');
    const objects = new PdfObjects();
    const fonts = new DocumentFonts(objects, registryFontSource);
    const font = (await fonts.face('pdf-inter-miss', 400, 'normal'))!;
    expect(font.use(0x1f600)).toBeNull();
    font.use(0x41);
    const s = await render(objects, fonts);
    expect(s).toContain('1 beginbfchar');
    expect(s).not.toMatch(/^<0000> <00/m);
  });

  it('answers null for a CFF face, a restricted face, or no bytes', async () => {
    registerInter('pdf-inter-null');
    const run = (source: PdfFontSource, family: string) =>
      new DocumentFonts(new PdfObjects(), source).face(family, 400, 'normal');
    expect(await run(withEmbedding({ outlines: 'cff' }), 'pdf-inter-null')).toBeNull();
    expect(await run(withEmbedding({ embeddable: false }), 'pdf-inter-null')).toBeNull();
    expect(await run(registryFontSource, 'pdf-nobody')).toBeNull();
  });

  it('embeds a face once however many runs use it', async () => {
    registerInter('pdf-inter-once');
    const objects = new PdfObjects();
    const fonts = new DocumentFonts(objects, registryFontSource);
    const [a, b] = await Promise.all([
      fonts.face('pdf-inter-once', 400, 'normal'),
      fonts.face('pdf-inter-once', 400, 'normal'),
    ]);
    expect(a).toBe(b);
    a!.use(0x41);
    const s = await render(objects, fonts);
    expect(s.match(/\/Subtype \/Type0/g)).toHaveLength(1);
    expect(s.match(/\/FontFile2/g)).toHaveLength(1);
  });

  it('synthesizes a BaseFont when the face has no PostScript name', async () => {
    registerInter('pdf-inter-name', { style: 'italic' });
    const objects = new PdfObjects();
    const fonts = new DocumentFonts(objects, withEmbedding({ postScriptName: '' }));
    const font = (await fonts.face('pdf-inter-name', 400, 'italic'))!;
    font.use(0x41);
    const s = await render(objects, fonts);
    expect(s).toMatch(/\/BaseFont \/[A-Z]{6}\+pdf-inter-name-400-italic\b/);
  });

  it('strips characters a PDF name cannot carry from a synthesized BaseFont', async () => {
    registerInter('My Font (x)', { weight: 700 });
    const objects = new PdfObjects();
    const fonts = new DocumentFonts(objects, withEmbedding({ postScriptName: '' }));
    (await fonts.face('My Font (x)', 700, 'normal'))!.use(0x41);
    expect(await render(objects, fonts)).toMatch(/\/BaseFont \/[A-Z]{6}\+MyFontx-700-normal\b/);
  });

  it('leaves a face that was fetched and never used out of the file', async () => {
    registerInter('pdf-inter-idle');
    const objects = new PdfObjects();
    const fonts = new DocumentFonts(objects, registryFontSource);
    const font = (await fonts.face('pdf-inter-idle', 400, 'normal'))!;
    expect(font.use(0x1f600)).toBeNull();
    const s = await render(objects, fonts);
    expect(s).not.toContain('/Type0');
    expect(s).not.toContain('/FontFile2');
  });

  it('refuses a ref until a glyph has been used', async () => {
    registerInter('pdf-inter-ref');
    const fonts = new DocumentFonts(new PdfObjects(), registryFontSource);
    const font = (await fonts.face('pdf-inter-ref', 400, 'normal'))!;
    expect(() => font.ref).toThrow();
    font.use(0x41);
    expect(font.ref.id).toBeGreaterThan(0);
  });

  it('treats a rejected embedding as no face', async () => {
    const source: PdfFontSource = { ...registryFontSource, embedding: async () => Promise.reject(new Error('boom')) };
    const objects = new PdfObjects();
    const fonts = new DocumentFonts(objects, source);
    expect(await fonts.face('pdf-x', 400, 'normal')).toBeNull();
    await expect(fonts.finish()).resolves.toBeUndefined();
  });

  it('writes nothing on a second finish', async () => {
    registerInter('pdf-inter-twice');
    const once = async (extra: number) => {
      const objects = new PdfObjects();
      const fonts = new DocumentFonts(objects, registryFontSource);
      (await fonts.face('pdf-inter-twice', 400, 'normal'))!.use(0x41);
      for (let i = 0; i < extra; i++) await fonts.finish();
      return (await render(objects, fonts)).match(/ 0 obj\n/g)!.length;
    };
    expect(await once(1)).toBe(await once(0));
  });

  it('declares the CMap character collection', async () => {
    registerInter('pdf-inter-cmap');
    const objects = new PdfObjects();
    const fonts = new DocumentFonts(objects, registryFontSource);
    (await fonts.face('pdf-inter-cmap', 400, 'normal'))!.use(0x41);
    expect(await render(objects, fonts)).toContain(
      '/CIDSystemInfo << /Registry (Adobe) /Ordering (UCS) /Supplement 0 >> def\n/CMapName',
    );
  });
});
