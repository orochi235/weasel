import { createRevision } from '../widget';
import type { Widget, WidgetBounds, HudDrawCtx, HudKeyEvent, HudPointerEvent } from '../widget';
import type { DrawCommand } from '@weasel-js/core/renderer';
import { textCommandFromRuns } from '@weasel-js/core';
import { roundRectPath } from '@weasel-js/geom';
import {
  envPx, exactly, IDLE_PRESS, isPressKey, measureButton, pressStep,
  type ButtonFace, type ButtonLayout, type ButtonSize, type HeadlessComponent, type PressInput, type PressState,
} from '@weasel-js/headless';
import { hudMeasureEnv } from '../measureEnv';

/** The events a button reports through `on` / `off`. */
export type ButtonEvent = 'press' | 'hover' | 'leave';
/** A button event listener. */
export type ButtonHandler = () => void;

/** Options for a button widget. The three fill colors cover its rest, hover
 *  and pressed states. */
export interface ButtonOptions {
  id: string;
  x: number; y: number; w: number; h: number;
  label: string;
  /** The type scale the label is set at, as ui's `Button` takes it. Default `'md'`. */
  size?: ButtonSize;
  fill?: string;
  pressedFill?: string;
  hoverFill?: string;
  textColor?: string;
  /** Overrides the size's font size, as `--wzl-field-font-size` does a DOM button's. */
  fontSize?: number;
  fontFamily?: string;
  /** CSS cursor over the button's bounds. Defaults to `'pointer'`. */
  cursor?: string;
  /** Whether Tab and a press give the button keyboard focus. Default true;
   *  a focused button presses on Enter or Space. */
  focusable?: boolean;
  /** Position in the HUD's tab order; see {@link Widget.tabOrder}. */
  tabOrder?: number;
  /** Injected by Hud factories to trigger redraw on mutation. */
  onChange?: () => void;
  /** Injected by Hud factories. Called from dispose() to remove this widget
   *  from its HUD's list. No-op for bare-factory consumers. */
  removeFromHud?: () => void;
}

/** A clickable labeled box that tracks hover and press state itself and
 *  reports them to listeners. */
export interface ButtonWidget extends Widget {
  setLabel(label: string): void;
  setBounds(b: WidgetBounds): void;
  setHidden(hidden: boolean): void;
  on(event: ButtonEvent, handler: ButtonHandler): void;
  off(event: ButtonEvent, handler: ButtonHandler): void;
  dispose(): void;
}

/** A HUD button's state: what it shows, and where a press on it stands. */
export interface HudButtonState extends ButtonFace<string> {
  readonly press: PressState;
}

/** Where a HUD button draws, and the colors and face it draws in; each color defaults to the theme's. */
export interface HudButtonTarget {
  readonly bounds: WidgetBounds;
  readonly ctx: HudDrawCtx;
  readonly fill?: string;
  readonly hoverFill?: string;
  readonly pressedFill?: string;
  readonly textColor?: string;
  readonly fontFamily?: string;
  readonly fontSize?: number;
}

const fontOverride = (fontSize: number | undefined) =>
  (fontSize !== undefined ? { '--wzl-field-font-size': `${fontSize}px` } : undefined);

/**
 * A button on a HUD, on the contract ui's `Button` implements in the DOM: one `measure` from `@weasel-js/headless`,
 * and a `draw` that lays its parts into `target.bounds` and paints them as draw commands.
 */
export const hudButton: HeadlessComponent<HudButtonState, ButtonLayout, HudButtonTarget, DrawCommand[]> = {
  measure: measureButton,
  draw(state, target) {
    const { bounds: b, ctx } = target;
    const t = ctx.tokens;
    const env = hudMeasureEnv(ctx, target.fontFamily, fontOverride(target.fontSize));
    const { layout } = measureButton(state, exactly(b.w, b.h), env);
    const color = state.press.held ? target.pressedFill ?? t['--wzl-surface-pressed']
      : state.press.hovered ? target.hoverFill ?? t['--wzl-surface-hover']
        : target.fill ?? t['--wzl-surface-raised'];
    // ui's Button.module.css: `--wzl-button-radius`, else a tenth of the height.
    const radius = envPx(env, '--wzl-button-radius', b.h * 0.1);
    const out: DrawCommand[] = [{
      kind: 'path', path: roundRectPath(b.x, b.y, b.w, b.h, radius), fill: { paint: { kind: 'solid', color } },
    }];
    for (const { part, rect } of layout.parts) {
      if (part !== 'label') continue;
      out.push(textCommandFromRuns(
        b.x + rect.x, b.y,
        [{ text: state.label ?? '', fill: { paint: { kind: 'solid', color: target.textColor ?? t['--wzl-fg'] } } }],
        { fontFamily: target.fontFamily ?? ctx.defaultFont, fontSize: layout.metrics.font.size },
        undefined, b.h, 'center',
      ));
    }
    return out;
  },
};

/** A HUD pointer event as a press reads it, or null for one a press ignores. */
function pressInput(evt: HudPointerEvent, inside: (x: number, y: number) => boolean): PressInput | null {
  switch (evt.type) {
    case 'down': return { type: 'down' };
    case 'move': case 'up': return { type: evt.type, inside: inside(evt.x, evt.y) };
    case 'cancel': return { type: 'cancel' };
    case 'hovermove': return { type: 'enter' };
    case 'hoverleave': return { type: 'leave' };
    default: return null;
  }
}

export function createButton(opts: ButtonOptions): ButtonWidget {
  if (opts.w <= 0 || opts.h <= 0) {
    throw new Error(`createButton: bounds must have positive w/h`);
  }
  let disposed = false;
  const rev = createRevision(opts.onChange);
  let bounds: WidgetBounds = { x: opts.x, y: opts.y, w: opts.w, h: opts.h };
  let hidden = false;
  let label = opts.label;
  let press: PressState = IDLE_PRESS;

  const handlers: Record<ButtonEvent, Set<ButtonHandler>> = {
    press: new Set(),
    hover: new Set(),
    leave: new Set(),
  };
  const emit = (e: ButtonEvent) => { for (const h of handlers[e]) h(); };

  const isInside = (x: number, y: number) =>
    x >= bounds.x && x < bounds.x + bounds.w && y >= bounds.y && y < bounds.y + bounds.h;

  const assertNotDisposed = () => {
    if (disposed) throw new Error('weasel-hud: cannot mutate a disposed widget.');
  };

  return {
    id: opts.id,
    deps: rev.deps,
    get bounds() { return bounds; },
    get hidden() { return hidden; },
    get disposed() { return disposed; },
    focusable: opts.focusable ?? true,
    ...(opts.tabOrder !== undefined ? { tabOrder: opts.tabOrder } : {}),
    get accessibleName() { return label; },
    onKey(evt: HudKeyEvent): boolean {
      if (evt.type !== 'keydown' || !isPressKey(evt.key)) return false;
      emit('press');
      return true;
    },
    setBounds(b) { assertNotDisposed(); bounds = { ...b }; rev.changed(); },
    setHidden(h) { assertNotDisposed(); hidden = h; rev.changed(); },
    setLabel(l) { assertNotDisposed(); label = l; rev.changed(); },
    on(event, handler) { assertNotDisposed(); handlers[event].add(handler); },
    off(event, handler) { assertNotDisposed(); handlers[event].delete(handler); },
    draw(ctx: HudDrawCtx): DrawCommand[] {
      return hudButton.draw({ label, size: opts.size, press }, {
        bounds, ctx, fill: opts.fill, hoverFill: opts.hoverFill, pressedFill: opts.pressedFill,
        textColor: opts.textColor, fontFamily: opts.fontFamily, fontSize: opts.fontSize,
      });
    },
    hitTest(x, y) {
      if (hidden) return false;
      return isInside(x, y);
    },
    cursorAt(x, y) {
      if (hidden || !isInside(x, y)) return 'default';
      return opts.cursor ?? 'pointer';
    },
    // A double-click already fired two presses; the other arms are claimed so
    // they don't reach the scene, not because a button reacts to them.
    onPointer(evt: HudPointerEvent): void {
      const input = pressInput(evt, isInside);
      if (!input) return;
      const was = press;
      const step = pressStep(press, input);
      press = step.state;
      if (step.pressed) emit('press');
      if (press.hovered !== was.hovered) emit(press.hovered ? 'hover' : 'leave');
      if (press !== was && (press.held !== was.held || press.hovered !== was.hovered)) rev.changed();
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      opts.removeFromHud?.();
      for (const set of Object.values(handlers)) set.clear();
    },
  };
}
