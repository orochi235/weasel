import { placeMenu, placeSubmenu, type MenuController, type MenuEntry, type Rect } from '@weasel-js/menu';
import { faceGeneration } from '@weasel-js/font';
import { panelSize, rowLayout, type MenuMetrics } from './drawPanel';

type XY = { x: number; y: number };

/** What placing needs: where the menu opened, the canvas, and how to measure. */
export interface PlaceOptions {
  anchor: XY;
  canvasSize(): { width: number; height: number };
  measure(text: string, fontSize: number, fontFamily: string): number;
  metrics: MenuMetrics;
}

interface Placed {
  entries: readonly MenuEntry[];
  parentRow: number | null;
  rect: Rect;
}

/**
 * Places each open level once, when it opens: a level keeps its rect for as
 * long as its entries and the parent row it hangs from stay the same. A new
 * font family, or a face landing, re-measures everything.
 */
export function createPlacer(opts: PlaceOptions): (c: MenuController, fontFamily: string) => Rect[] {
  let placed: Placed[] = [];
  let measured: { family: string; faces: number } | null = null;

  return (c, fontFamily) => {
    const faces = faceGeneration();
    if (measured?.family !== fontFamily || measured.faces !== faces) {
      placed = [];
      measured = { family: fontFamily, faces };
    }
    const { width, height } = opts.canvasSize();
    const bounds = { x: 0, y: 0, w: width, h: height };
    const m = opts.metrics;
    const stack = c.stack();
    const next: Placed[] = [];
    let kept = true;
    for (let level = 0; level < stack.length; level++) {
      const entries = c.entriesAt(level);
      const parentRow = level === 0 ? null : stack[level - 1] ?? null;
      const old = placed[level];
      if (kept && old && old.entries === entries && old.parentRow === parentRow) {
        next.push(old);
        continue;
      }
      kept = false;
      const size = panelSize(entries, m, (t, s) => opts.measure(t, s, fontFamily));
      let at: XY;
      if (level === 0) {
        at = placeMenu(size, opts.anchor, bounds);
      } else {
        const parent = next[level - 1]!.rect;
        const row = rowLayout(c.entriesAt(level - 1), m)[parentRow!]!;
        at = placeSubmenu(size, { x: parent.x, y: parent.y + row.y, w: parent.w, h: row.h }, bounds);
      }
      const rect = { x: at.x, y: at.y, w: size.w, h: size.h };
      next.push({ entries, parentRow, rect });
      c.setPanel(level, rect);
    }
    placed = next;
    return next.map((p) => p.rect);
  };
}
