import type { DrawCommand } from '@weasel-js/core/renderer';
import { textCommandFromRuns } from '@weasel-js/core';
import { roundRectPath } from '@weasel-js/geom';
import {
  envPx, exactly, measureRowList,
  type HeadlessComponent, type ListMode, type RowFace, type RowListLayout,
} from '@weasel-js/ui-logic';
import { resolveCurrentColor } from '@weasel-js/theme';
import { hudMeasureEnv } from '../../measureEnv';
import type { HudDrawCtx, WidgetBounds } from '../../widget';

/** One row of a HUD list. */
export interface HudListRow extends RowFace {
  /** The row the list considers current. In a list that selects, also announced as selected. */
  readonly selected?: boolean;
  /** Present but not in effect, drawn subtle. */
  readonly muted?: boolean;
  /** A color drawn as a square before the label. */
  readonly swatch?: string;
}

/** A HUD list's state: its rows, and where the keyboard and pointer are among them. */
export interface HudListState {
  readonly rows: readonly HudListRow[];
  readonly empty?: string;
  readonly mode: ListMode;
  /** The row the keyboard is on. */
  readonly active: number | null;
  readonly hover: number | null;
  /** Whether the active row shows its focus ring: the list holds focus and the keyboard has been used. */
  readonly ring: boolean;
}

/** Where a HUD list draws. */
export interface HudListTarget {
  readonly bounds: WidgetBounds;
  readonly ctx: HudDrawCtx;
  readonly fontFamily?: string;
}

/** The swatch's side; its row's leading slot is this wide. */
export const SWATCH_SIZE = 12;
const RING_WIDTH = 2;

const solid = (color: string) => ({ paint: { kind: 'solid' as const, color } });

/**
 * A row list on a HUD, on the contract ui's `ItemList` implements in the DOM: one `measure` from
 * `@weasel-js/ui-logic`, and a `draw` that lays the rows into `target.bounds` and paints them as `ItemList.module.css`
 * styles them: the selected row on `--wzl-border`, the hovered on `--wzl-surface`, the keyboard's row ringed.
 */
export const hudList: HeadlessComponent<HudListState, RowListLayout, HudListTarget, DrawCommand[]> = {
  measure: measureRowList,
  draw(state, target) {
    const { bounds: b, ctx } = target;
    const t = ctx.tokens;
    const fg = t['--wzl-fg'];
    const subtle = resolveCurrentColor(t['--wzl-fg-subtle'], fg);
    const env = hudMeasureEnv(ctx, target.fontFamily);
    const { layout } = measureRowList(state, exactly(b.w, b.h), env);
    const font = { fontFamily: target.fontFamily ?? ctx.defaultFont, fontSize: layout.metrics.font.size };
    const text = (s: string, x: number, y: number, h: number, color: string): DrawCommand =>
      textCommandFromRuns(x, y, [{ text: s, fill: solid(color) }], font, undefined, h, 'center');
    if (layout.empty) {
      const e = layout.empty;
      return [text(state.empty ?? '—', b.x + e.x, b.y + e.y, e.height, subtle)];
    }
    const radius = envPx(env, '--wzl-radius-sm', 0);
    const out: DrawCommand[] = [];
    layout.rows.forEach((box, i) => {
      const row = state.rows[i]!;
      const r = box.rect;
      const x = b.x + r.x, y = b.y + r.y;
      const fill = row.selected ? t['--wzl-border'] : state.hover === i ? t['--wzl-surface'] : undefined;
      if (fill) out.push({ kind: 'path', path: roundRectPath(x, y, r.width, r.height, radius), fill: solid(fill) });
      if (row.swatch && box.leading) {
        const l = box.leading;
        out.push({
          kind: 'path',
          path: { kind: 'rect', x: b.x + l.x, y: b.y + l.y + (l.height - SWATCH_SIZE) / 2, width: SWATCH_SIZE, height: SWATCH_SIZE },
          fill: solid(row.swatch),
          stroke: { paint: { kind: 'solid', color: t['--wzl-border'] }, width: 1 },
        });
      }
      out.push(text(row.label, b.x + box.label.x, y, r.height, row.muted ? subtle : fg));
      // ItemList's `outline: 2px; outline-offset: -2px`: a ring just inside the row.
      if (state.ring && state.active === i) {
        const inset = RING_WIDTH / 2;
        out.push({
          kind: 'path',
          path: roundRectPath(x + inset, y + inset, r.width - RING_WIDTH, r.height - RING_WIDTH, radius),
          stroke: { paint: { kind: 'solid', color: t['--wzl-focus-ring'] }, width: RING_WIDTH },
        });
      }
    });
    return out;
  },
};
