import type { PdfFontSource } from '../fonts/fontSource';

export const NO_FONTS: PdfFontSource = {
  embedding: async () => null,
  outline: () => null,
};
