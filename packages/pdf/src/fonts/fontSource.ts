import type { FaceEmbedding, FontStyle } from '@weasel-js/font';

export interface PdfFontSource {
  embedding(family: string, weight: number, style: FontStyle): Promise<FaceEmbedding | null>;
  /** Em-space SVG path data, as glyphOutline answers it. */
  outline(family: string, weight: number, style: FontStyle, cp: number): string | null;
}
