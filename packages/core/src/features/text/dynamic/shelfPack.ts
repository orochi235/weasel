/**
 * Shelf packer for the dynamic glyph atlas: fixed-size square pages, rows
 * ("shelves") of same-ish-height rects filled left to right. Simple and
 * good enough for glyph rects; no rotation, no eviction (v1).
 */

export interface ShelfAlloc {
  page: number;
  x: number;
  y: number;
}

interface Shelf { y: number; height: number; x: number; }
interface Page { shelves: Shelf[]; nextY: number; }

export class ShelfPacker {
  private pages: Page[] = [];
  private warned = false;

  constructor(
    private readonly pageSize: number,
    private readonly maxPages: number,
  ) {}

  get pageCount(): number {
    return this.pages.length;
  }

  /** Allocate a w×h rect. Returns null (warning once) when capacity is out. */
  alloc(w: number, h: number): ShelfAlloc | null {
    if (w > this.pageSize || h > this.pageSize) return this.fail();
    for (let p = 0; p < this.pages.length; p++) {
      const spot = this.allocInPage(this.pages[p], w, h);
      if (spot) return { page: p, ...spot };
    }
    if (this.pages.length < this.maxPages) {
      const page: Page = { shelves: [], nextY: 0 };
      this.pages.push(page);
      const spot = this.allocInPage(page, w, h);
      if (spot) return { page: this.pages.length - 1, ...spot };
    }
    return this.fail();
  }

  private allocInPage(page: Page, w: number, h: number): { x: number; y: number } | null {
    for (const shelf of page.shelves) {
      if (h <= shelf.height && shelf.x + w <= this.pageSize) {
        const x = shelf.x;
        shelf.x += w;
        return { x, y: shelf.y };
      }
    }
    if (page.nextY + h <= this.pageSize) {
      const shelf: Shelf = { y: page.nextY, height: h, x: w };
      page.shelves.push(shelf);
      page.nextY += h;
      return { x: 0, y: shelf.y };
    }
    return null;
  }

  private fail(): null {
    if (!this.warned) {
      this.warned = true;
      console.warn(
        `weasel DynamicGlyphAtlas: glyph pages full (${this.maxPages} × ${this.pageSize}²); ` +
        'further dynamic glyphs will not render.',
      );
    }
    return null;
  }
}
