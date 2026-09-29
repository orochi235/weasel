import type { DrawCommand } from '@weasel-js/core/renderer';
import type { ClaimableGesture, View } from '@weasel-js/core';
import type { ResolvedTheme } from '@weasel-js/theme';

/** A widget's rectangle, in screen-space CSS pixels relative to the canvas. */
export interface WidgetBounds {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Everything a widget is given to draw itself. Deliberately carries no scene
 *  data, which is what lets a HUD render identically headlessly — a window's
 *  `content` painter is the one opt-in exception (see {@link HudContentCtx}). */
export interface HudDrawCtx {
  /** Canvas size in CSS pixels. */
  dims: { width: number; height: number };
  /** Family name of the auto-registered default font. */
  defaultFont: string;
  /** The resolved theme, keyed by CSS custom-property name. Supplied by the
   *  caller rather than read back off the DOM, so a HUD drawn headlessly is
   *  themed the same way one drawn in a browser is. */
  tokens: ResolvedTheme;
  /** The `i`th color of the theme's tone list, wrapping — what a widget's
   *  numeric `tone` names. */
  toneAt(i: number): string;
}

/**
 * Input to a widget's optional `content` painter — the one place hud sees
 * the scene. `HudDrawCtx` stays data-free so widgets stay renderable
 * headlessly; this is an explicit opt-in on the composite instead.
 */
export interface HudContentCtx {
  /** Scene data the hud layer was handed. Opaque here; painters that need
   *  it cast to a known shape, as tools do with `ToolCtx.adapter`. */
  data: unknown;
  /** The outer view. A painter deriving an inner view starts from this. */
  view: View;
  dims: { width: number; height: number };
  /** Where the content is painted, in screen-space CSS px. The group the
   *  painter's commands land in carries a clip but no transform, so those
   *  commands are in absolute canvas coordinates — a painter that treats the
   *  rect's origin as (0,0) silently draws nothing. */
  rect: WidgetBounds;
  defaultFont: string;
  tokens: ResolvedTheme;
  toneAt(i: number): string;
}

/**
 * Input handed to a widget, in screen space.
 *
 * `native` is the originating DOM event when there is one, and `null`
 * otherwise — it is **not** guaranteed. Hover arrives through the layer's
 * `onUncapturedMove`, so `hovermove` carries the real `PointerEvent` — and,
 * being uncaptured-only, stops for the duration of any drag.
 * Every other arm arrives through the gesture dispatcher, which hands
 * actions normalized input rather than the event that produced it, so they
 * carry `null`. A widget that needs `native` must handle its absence;
 * prefer the normalized `x` / `y` and the event `type`.
 */
export type HudPointerEvent =
  | { type: 'down'; x: number; y: number; native: PointerEvent | null }
  | { type: 'move'; x: number; y: number; native: PointerEvent | null }
  | { type: 'up'; x: number; y: number; native: PointerEvent | null }
  | { type: 'cancel'; native: PointerEvent | null }
  | { type: 'hovermove'; x: number; y: number; native: PointerEvent | null }
  | { type: 'hoverleave'; native: PointerEvent | null }
  | { type: 'doubleclick'; x: number; y: number; native: PointerEvent | null }
  | { type: 'contextmenu'; x: number; y: number; native: PointerEvent | null }
  | { type: 'longpress'; x: number; y: number; native: PointerEvent | null }
  | {
      type: 'wheel'; x: number; y: number;
      deltaX: number; deltaY: number; native: PointerEvent | null;
    };

/**
 * A key event delivered to the focused widget, from the canvas element that
 * holds DOM focus. `native` is the originating `KeyboardEvent` when there is
 * one; a test or a headless host may pass `null`.
 */
export interface HudKeyEvent {
  type: 'keydown' | 'keyup';
  key: string;
  code: string;
  altKey: boolean;
  ctrlKey: boolean;
  metaKey: boolean;
  shiftKey: boolean;
  repeat: boolean;
  native: KeyboardEvent | null;
}

/**
 * A kit widget's change counter. Every setter calls `changed`, which is also
 * what schedules the redraw, so a mutation cannot repaint without
 * invalidating the widget's cached commands. `deps` is the widget's
 * {@link Widget.deps}.
 */
export function createRevision(onChange: (() => void) | undefined): {
  changed(): void;
  deps(): readonly unknown[];
} {
  let revision = 0;
  return {
    changed() { revision++; onChange?.(); },
    deps: () => [revision],
  };
}

/** True when `w` can take keyboard focus right now: it declares `focusable`,
 *  is showing, and has not been disposed. */
export function isFocusable(w: Widget): boolean {
  return w.focusable === true && !w.hidden && w.disposed !== true;
}

/** What a widget consumes when it declares nothing: chrome is opaque to every
 *  pointer-family gesture except the wheel, which stays with the viewport
 *  unless a widget asks for it. */
export const DEFAULT_WIDGET_CLAIMS: readonly ClaimableGesture[] =
  ['pointer', 'doubleClick', 'contextMenu', 'longPress'];

/** The gestures `w` consumes, applying {@link DEFAULT_WIDGET_CLAIMS} when the
 *  widget declares none. */
export function claimsOf(w: Widget): readonly ClaimableGesture[] {
  return w.claims ?? DEFAULT_WIDGET_CLAIMS;
}

/** Cursor for a point on `w`: what the widget says, else `'pointer'` if it
 *  takes the press at all. Keyed on the claim a widget already declares, so a
 *  consumer-authored widget answers without implementing anything; decoration
 *  never reaches here, since the hit walk descends past it. */
export function cursorOf(w: Widget, x: number, y: number): string | undefined {
  return w.cursorAt?.(x, y)
    ?? (claimsOf(w).includes('pointer') ? 'pointer' : undefined);
}

/**
 * The contract every HUD widget implements: a rectangle, a painter, a
 * hit-test, and a pointer handler. Widgets are plain objects — consumers can
 * write their own without any registration step.
 */
export interface Widget {
  readonly id: string;
  readonly bounds: WidgetBounds;
  readonly hidden: boolean;
  draw(ctx: HudDrawCtx): DrawCommand[];
  /**
   * What `draw` reads besides `ctx`, `bounds` and focus, which the HUD
   * already watches. Declared, the HUD reuses the widget's previous commands
   * for as long as every entry is `Object.is`-equal to the last call's — the
   * same contract as `RenderLayer.deps`. Absent, `draw` runs on every repaint,
   * which is right for a readout that changes every frame anyway.
   *
   * The commands `draw` returns must then be treated as immutable: a cached
   * tree is handed to the renderer again on later frames.
   */
  deps?(ctx: HudDrawCtx): readonly unknown[];
  /** Optional interior painter, drawn beneath every widget frame and
   *  clipped to `contentRect`. See {@link HudContentCtx}. */
  content?(ctx: HudContentCtx): DrawCommand[];
  /** Region `content` is clipped to. Required when `content` is set. */
  readonly contentRect?: WidgetBounds;
  hitTest(x: number, y: number): boolean;
  /** True where the widget covers a point but hands its input to what it
   *  shows — a window whose interior is a view on the canvas. The hit walk
   *  stops there without claiming, so neither a widget beneath nor the HUD
   *  takes the press. */
  passes?(x: number, y: number): boolean;
  /** Which gestures this widget consumes. Absent means
   *  {@link DEFAULT_WIDGET_CLAIMS}; `[]` is decoration, and the hit-test walk
   *  descends past it to whatever lies beneath. Anything not listed falls
   *  through to the scene. */
  readonly claims?: readonly ClaimableGesture[];
  /** CSS cursor for a point inside this widget, in screen space. Resolved per
   *  point rather than read off hover state, because the layer's `hitTest`
   *  runs for a point and hover state may lag it. */
  cursorAt?(x: number, y: number): string;
  onPointer(evt: HudPointerEvent): void;
  /** True if the widget takes keyboard focus. A press on it focuses it, and
   *  Tab reaches it. Absent means false. */
  readonly focusable?: boolean;
  /** Position in the HUD's tab order. Widgets that declare one come first,
   *  ascending; the rest follow in the order they were added. */
  readonly tabOrder?: number;
  /** What assistive tech announces when this widget takes focus. */
  readonly accessibleName?: string;
  /** Key input while this widget is focused. Return `true` for a key the
   *  widget handled: it then never reaches the canvas's key bindings. Return
   *  `false` and the key falls through to them as if nothing were focused. */
  onKey?(evt: HudKeyEvent): boolean;
  /** Called when the widget gains (`true`) or loses (`false`) focus. */
  onFocusChange?(focused: boolean): void;
  /** Called by Hud.remove or widget.dispose. Detach event listeners, etc. */
  dispose(): void;
  /** True once disposed. A consumer holding a widget after `hud.remove`
   *  otherwise has no way to ask whether it is still live. Optional so a
   *  hand-written widget stays a plain object; every kit widget reports it. */
  readonly disposed?: boolean;
}
