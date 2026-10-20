/** The paper sizes Page Setup offers, portrait, in world units at 96 per inch. */
export const PAPER_SIZES = [
  { id: 'letter', label: 'Letter', width: 816, height: 1056 },
  { id: 'legal', label: 'Legal', width: 816, height: 1344 },
  { id: 'tabloid', label: 'Tabloid', width: 1056, height: 1632 },
  { id: 'a4', label: 'A4', width: 794, height: 1123 },
  { id: 'a3', label: 'A3', width: 1123, height: 1587 },
] as const;

export type PaperId = (typeof PAPER_SIZES)[number]['id'] | 'custom';
export type Orientation = 'portrait' | 'landscape';

export interface PageSize { width: number; height: number }

/** A page size as Page Setup shows it: which paper, which way up, and the size itself. */
export interface PageSetup extends PageSize {
  paper: PaperId;
  orientation: Orientation;
}

/** The size of `paper` turned `orientation`. A custom paper has no size of its own and answers `null`. */
export function paperSize(paper: PaperId, orientation: Orientation): PageSize | null {
  const found = PAPER_SIZES.find((p) => p.id === paper);
  if (!found) return null;
  const [short, long] = [found.width, found.height];
  return orientation === 'portrait' ? { width: short, height: long } : { width: long, height: short };
}

/** How Page Setup reads an existing page's size: a listed paper either way up, else custom. */
export function setupOf(size: PageSize): PageSetup {
  const orientation: Orientation = size.width > size.height ? 'landscape' : 'portrait';
  for (const p of PAPER_SIZES) {
    const s = paperSize(p.id, orientation)!;
    if (s.width === size.width && s.height === size.height) return { paper: p.id, orientation, ...s };
  }
  return { paper: 'custom', orientation, width: size.width, height: size.height };
}
