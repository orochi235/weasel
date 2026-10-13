/** Every paper size draw offers. Dimensions are CSS px; the key is what a
 *  saved document and an exported SVG's `wd:paperSize` carry. */
export const PAPER_SIZES = [
  { key: 'letter', label: 'US Letter', width: 816, height: 1056 },
  { key: 'a4', label: 'A4', width: 794, height: 1123 },
  { key: 'legal', label: 'Legal', width: 816, height: 1344 },
] as const;

export type PaperSizeKey = (typeof PAPER_SIZES)[number]['key'];

export const DEFAULT_PAPER_SIZE: PaperSizeKey = 'letter';

export const PAPER_PRESETS = Object.fromEntries(
  PAPER_SIZES.map(({ key, width, height }) => [key, { width, height }]),
) as Record<PaperSizeKey, { width: number; height: number }>;

/** The sizes as `{ value, label }`, the shape a menu or a select takes. */
export const PAPER_OPTIONS: ReadonlyArray<{ value: PaperSizeKey; label: string }> =
  PAPER_SIZES.map(({ key, label }) => ({ value: key, label }));

export const isPaperSize = (v: unknown): v is PaperSizeKey =>
  typeof v === 'string' && Object.hasOwn(PAPER_PRESETS, v);
