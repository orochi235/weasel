import { placeMenu, placeMenuUnder, placeSubmenu, type MenuController, type MenuEntry, type Rect } from '@weasel-js/menu';
import { faceGeneration } from '@weasel-js/font';
import { menuPanelMetrics, menuRowSpans, type MenuPanelLayout } from '@weasel-js/ui-logic';
import type { ResolvedTheme } from '@weasel-js/theme';
import { measurePanel } from './drawPanel';
import { estimateWidth } from './measureLabel';
import { menuMeasureEnv } from './menuEnv';

type XY = { x: number; y: number };

/** What placing needs: where the menu opened, the canvas, and how to measure. */
export interface PlaceOptions {
  anchor: XY;
  /** The button the menu hangs from, in canvas pixels; when set, `anchor` is not used. */
  under?: Rect;
  canvasSize(): { width: number; height: number };
  measure(text: string, fontSize: number, fontFamily: string): number;
}

/** An open level's panel: where it sits, and where its rows sit inside it. */
export interface PlacedPanel {
  readonly rect: Rect;
  readonly layout: MenuPanelLayout;
}

interface Placed extends PlacedPanel {
  entries: readonly MenuEntry[];
  parentRow: number | null;
}

/**
 * Places each open level once, when it opens: a level keeps its rect for as
 * long as its entries and the parent row it hangs from stay the same. A new
 * font family or theme, or a face landing, re-measures everything. With no family yet
 * — the hud has not drawn — widths are estimated rather than measured in a
 * guessed family.
 */
export function createPlacer(opts: PlaceOptions): (
  c: MenuController, fontFamily: string | null, tokens: ResolvedTheme,
) => PlacedPanel[] {
  let placed: Placed[] = [];
  let measured: { family: string | null; faces: number; tokens: ResolvedTheme } | null = null;

  return (c, fontFamily, tokens) => {
    const faces = faceGeneration();
    if (measured?.family !== fontFamily || measured.faces !== faces || measured.tokens !== tokens) {
      placed = [];
      measured = { family: fontFamily, faces, tokens };
    }
    const env = menuMeasureEnv(tokens, fontFamily ?? '',
      (t, s) => (fontFamily === null ? estimateWidth(t, s) : opts.measure(t, s, fontFamily)));
    const m = menuPanelMetrics(env);
    const { width, height } = opts.canvasSize();
    const bounds = { x: 0, y: 0, w: width, h: height };
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
      const box = measurePanel(entries, env);
      const size = { w: box.width, h: box.height };
      let at: XY;
      if (level === 0) {
        at = opts.under ? placeMenuUnder(size, opts.under, bounds) : placeMenu(size, opts.anchor, bounds);
      } else {
        const parent = next[level - 1]!.rect;
        const row = menuRowSpans(c.entriesAt(level - 1), m)[parentRow!]!;
        at = placeSubmenu(size, { x: parent.x, y: parent.y + row.y, w: parent.w, h: row.h }, bounds);
      }
      const rect = { x: at.x, y: at.y, w: size.w, h: size.h };
      next.push({ entries, parentRow, rect, layout: box.layout });
      c.setPanel(level, rect);
    }
    placed = next;
    return next.map(({ rect, layout }) => ({ rect, layout }));
  };
}
