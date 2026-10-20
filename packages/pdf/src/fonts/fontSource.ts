import { type FaceEmbedding, type FontStyle, fontEmbedding, glyphOutline } from '@weasel-js/font';

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
