import { createRevision } from '../widget';
import type { Widget, WidgetBounds, HudDrawCtx, HudPointerEvent } from '../widget';
import type { DrawCommand, TextDrawCommand } from '@weasel-js/core/renderer';
import {
  clearRuns, dropRuns, textCommandFromRuns, textCommandFromRunsInto, type StyledRun, type TextStyle,
} from '@weasel-js/core';
import type { Fill } from '@weasel-js/paint';

/** The one run every text widget hands `textCommandFromRuns`, which keeps
 *  nothing of it: it resolves a run of its own from it. */
const RUN: StyledRun = { text: '' };
const RUNS: readonly StyledRun[] = [RUN];

/** Options for a text widget. `x`/`y` place the text; its bounds follow from
 *  the string and font size. */
export interface TextOptions {
  id: string;
  x: number; y: number;
  text: string;
  fontSize: number;
  color?: string;
  /** Optional; falls back to the HUD default font from HudDrawCtx. */
  fontFamily?: string;
  /** Injected by Hud factories to trigger redraw on mutation. */
  onChange?: () => void;
  /** Injected by Hud factories. Called from dispose() to remove this widget
   *  from its HUD's list. No-op for bare-factory consumers. */
  removeFromHud?: () => void;
}

/** A single run of text drawn at a point. */
export interface TextWidget extends Widget {
  setText(text: string): void;
  setHidden(hidden: boolean): void;
  setBounds(b: WidgetBounds): void;
  dispose(): void;
}

export function createText(opts: TextOptions): TextWidget {
  let disposed = false;
  const rev = createRevision(opts.onChange);
  let bounds: WidgetBounds = { x: opts.x, y: opts.y, w: 0, h: opts.fontSize };
  let text = opts.text;
  let hidden = false;
  /** The one command this widget draws, refilled in place with its runs when
   *  the text, color or family changes, and the text, color and family it
   *  holds. So what `draw` returned is the current text, not a snapshot. */
  let placed: TextDrawCommand | null = null;
  let placedText = '';
  let placedColor = '';
  let placedFamily = '';
  /** What `draw` returns, `[placed]`. */
  const out: DrawCommand[] = [];
  // Kept from one command to the next while their color and family hold.
  let fill: Fill = { paint: { kind: 'solid', color: '' } };
  let style: TextStyle = { fontFamily: '', fontSize: opts.fontSize };

  const assertNotDisposed = () => {
    if (disposed) throw new Error('weasel-hud: cannot mutate a disposed widget.');
  };

  return {
    id: opts.id,
    deps: rev.deps,
    get bounds() { return bounds; },
    get hidden() { return hidden; },
    get disposed() { return disposed; },
    setBounds(b) { assertNotDisposed(); bounds = { ...b }; rev.changed(); },
    setHidden(h) { assertNotDisposed(); hidden = h; rev.changed(); },
    setText(t) { assertNotDisposed(); text = t; rev.changed(); },
    draw(ctx: HudDrawCtx): DrawCommand[] {
      const color = opts.color ?? ctx.tokens['--wzl-fg'];
      const fontFamily = opts.fontFamily ?? ctx.defaultFont;
      if (placed === null || placedText !== text || placedColor !== color || placedFamily !== fontFamily) {
        if (placed === null || placedColor !== color) fill = { paint: { kind: 'solid', color } };
        if (placed === null || placedFamily !== fontFamily) style = { fontFamily, fontSize: opts.fontSize };
        RUN.text = text;
        RUN.fill = fill;
        if (placed === null) {
          placed = textCommandFromRuns(bounds.x, bounds.y, RUNS, style) as TextDrawCommand;
          out[0] = placed;
        } else {
          clearRuns(placed.runs);
          textCommandFromRunsInto(placed, bounds.x, bounds.y, RUNS, style);
        }
        RUN.fill = undefined;
        placedText = text; placedColor = color; placedFamily = fontFamily;
      }
      // A move keeps the runs, so the renderer's layout cache still has them.
      placed.x = bounds.x;
      placed.y = bounds.y;
      return out;
    },
    hitTest() { return false; },
    claims: [],
    onPointer(_evt: HudPointerEvent): void {},
    dispose() {
      if (disposed) return;
      disposed = true;
      if (placed !== null) dropRuns(placed.runs);
      opts.removeFromHud?.();
    },
  };
}
