import { type FaceEmbedding, type FontStyle, fontEmbedding, glyphOutline } from '@weasel-js/font';

/** Where the writer gets the font faces it embeds and the glyph outlines it falls back to; `registryFontSource` reads the font registry. */
export interface PdfFontSource {
  embedding(family: string, weight: number, style: FontStyle): Promise<FaceEmbedding | null>;
  /** Em-space SVG path data, as glyphOutline answers it. */
  outline(family: string, weight: number, style: FontStyle, cp: number): string | null;
}

/** The faces registered with `@weasel-js/font`. */
export const registryFontSource: PdfFontSource = {
  embedding: fontEmbedding,
  outline: glyphOutline,
};
