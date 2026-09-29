import type { Hud } from './hud';
import type { CanvasExtensionApi, RenderLayer, LayerHit, View } from '@weasel-js/core';
import type { DrawCommand } from '@weasel-js/core/renderer';
import { viewToTransform } from '@weasel-js/core';
import { worldToScreen } from '@weasel-js/core';
import {
  DEFAULT_FONT_FAMILY,
  registerDefaultFont,
  type FontAtlasUrls,
} from './fonts/registerDefaultFont';
import {
  claimsOf, cursorOf, isFocusable,
  type Widget, type HudKeyEvent, type HudPointerEvent,
} from './widget';
import type { HudHitPayload } from './tool';
import {
  colorAt, resolveTheme, themeTones, weaselTheme,
  type ColorContext, type ColorList, type ResolvedTheme,
} from '@weasel-js/theme';

export interface AttachHudOptions {
  /** Resolved theme the widgets draw with. Defaults to the built-in theme's
   *  default mode; pass `useTheme().resolved` to follow a live theme. */
  readonly theme?: ResolvedTheme;
  /** The tone list a widget's numeric `tone` indexes, and the theme it
   *  resolves against — `useTheme()`'s value is one. Defaults to the built-in
   *  theme's list, resolved against `theme`. */
  readonly tones?: ColorContext & { readonly tones: ColorList };
  /**
   * Where the text a widget draws without naming a family comes from.
   *
   * - A family name: that family, already registered by the host. The HUD
   *   fetches nothing, which is the point — an app that has registered Inter
   *   as `'sans-serif'` was downloading the HUD's byte-identical copy of it a
   *   second time.
   * - A `{ metricsUrl, atlasUrl }` pair: the HUD's own family, registered from
   *   the host's copy of the atlas rather than the bundled one.
   *
   * Unset, the bundled atlas is fetched and registered.
   */
  readonly font?: string | FontAtlasUrls;
}

/**
 * Bind a HUD to a canvas: register its render layer, route pointer input to
 * the widget under the cursor, and register the default font. Returns
 * the detach function.
 *
 * Throws if the HUD is already attached — a HUD belongs to one canvas at a
 * time.
 */
export function attachHud(
  api: CanvasExtensionApi,
  hud: Hud,
  options: AttachHudOptions = {},
): () => void {
  const theme = options.theme ?? resolveTheme(weaselTheme);
  const tones = options.tones ?? { theme: weaselTheme, resolved: theme, tones: themeTones(weaselTheme) };
  const toneAt = (i: number) => colorAt(tones.tones, i, tones);
  if (hud.attached) {
    throw new Error('weasel-hud: this HUD is already attached to a canvas.');
  }

  // Register the default font. It loads when a widget first lays out text,
  // which lays out as nothing until then. A named family is the host's to have
  // registered, so there is nothing to fetch and nothing to wait for.
  const font = options.font;
  const defaultFont = typeof font === 'string' ? font : DEFAULT_FONT_FAMILY;
  if (typeof font !== 'string') {
    registerDefaultFont(font)
      .then(() => api.requestRedraw())
      .catch((err) => {
        console.warn('weasel-hud: failed to register default font', err);
      });
  }

  // Track the currently-hovered widget at the closure level.
  let lastHovered: Widget | null = null;

  const findTopmostHit = (sx: number, sy: number): Widget | null => {
    const list = hud.widgets();
    for (let i = list.length - 1; i >= 0; i--) {
      const w = list[i];
      if (!w.hidden && w.passes?.(sx, sy)) return null;
      // Decoration is skipped rather than downgraded: a hit at all would let
      // `hud.press` consume the press, and the walk has to keep descending to
      // whatever is beneath — another widget, or the scene.
      if (claimsOf(w).length === 0) continue;
      if (!w.hidden && w.hitTest(sx, sy)) return w;
    }
    return null;
  };

  const layer: RenderLayer<unknown> = {
    id: 'weasel-hud',
    label: 'HUD',
    space: 'screen',
    draw: (data, view, dims): DrawCommand[] => {
      const ctx = { dims, defaultFont, tokens: theme, toneAt };
      const out: DrawCommand[] = [];
      // Pass 1: interiors. All content precedes all frames so one window's
      // content can never paint over another window's border.
      for (const w of hud.widgets()) {
        if (w.hidden || !w.content || !w.contentRect) continue;
        const rect = w.contentRect;
        if (rect.w <= 0 || rect.h <= 0) continue;
        const children = w.content({
          data, view, dims, rect, defaultFont, tokens: theme, toneAt,
        });
        if (children.length === 0) continue;
        out.push({
          kind: 'group',
          clip: { kind: 'rect', x: rect.x, y: rect.y, width: rect.w, height: rect.h },
          children,
        });
      }
      // Pass 2: frames.
      for (const w of hud.widgets()) {
        if (w.hidden) continue;
        for (const cmd of w.draw(ctx)) out.push(cmd);
      }
      // Pass 3: the focus ring, over every frame so a neighbor can't hide it.
      const f = hud.focused;
      if (f && hud.focusVisible && !f.hidden) out.push(focusRing(f, theme['--wzl-focus-ring']));
      return out;
    },
    hitTest: (worldX, worldY, _data, view, _dims): LayerHit | null => {
      // Convert world to screen so we can hit-test widget bounds.
      const t = viewToTransform(view);
      const [sx, sy] = worldToScreen(worldX, worldY, t);
      const hit = findTopmostHit(sx, sy);
      if (!hit) return null;
      const cursor = cursorOf(hit, sx, sy);
      // Report WHICH widget was hit and stop there. `<SceneCanvas>` folds this
      // into its `affordanceAt` thunk, so the hit reaches actions as an
      // `AffordanceHit` of kind `layer:weasel-hud` carrying this payload; the
      // `hud.pointer` action (see `tool.ts`) picks it up from there.
      //
      // This used to return a `DragChannel` for the tool-routing dispatcher to
      // drive directly. That dispatcher is gone, and a hit-test handing back
      // event handlers was always an odd shape — a hit-test should say what
      // was hit.
      // Exclusive: hud chrome floats over the scene, so a press on it is not a
      // press on whatever sits underneath. Bindings that don't consult the
      // affordance are barred from it by the dispatcher.
      return {
        initialScratch: { widget: hit },
        strength: 'exclusive',
        claimedKinds: claimsOf(hit),
        ...(cursor !== undefined ? { cursor } : {}),
      } satisfies LayerHit<HudHitPayload>;
    },
    onUncapturedMove: (worldX, worldY, evt, view: View) => {
      const t = viewToTransform(view);
      const [sx, sy] = worldToScreen(worldX, worldY, t);
      const hit = findTopmostHit(sx, sy);
      if (hit !== lastHovered) {
        if (lastHovered) lastHovered.onPointer({ type: 'hoverleave', native: evt } satisfies HudPointerEvent);
        lastHovered = hit;
        api.requestRedraw();
      }
      // Every move inside the widget, not only the one that entered it: the
      // event carries `x`/`y`, and a widget tracking hover position reads a
      // frozen point otherwise.
      if (hit) hit.onPointer({ type: 'hovermove', x: sx, y: sy, native: evt } satisfies HudPointerEvent);
    },
    onUncapturedLeave: () => {
      if (lastHovered) {
        lastHovered.onPointer({ type: 'hoverleave', native: null } satisfies HudPointerEvent);
        lastHovered = null;
        api.requestRedraw();
      }
    },
  };

  const detachLayer = api.registerLayer(layer);
  const detachFocus = api.element ? wireFocus(api.element, hud, findTopmostHit) : () => {};

  // Bind the HUD to a host shim. registerLayer is a no-op because the HUD has
  // already registered its single layer via api.registerLayer above.
  hud.bind({
    requestRedraw: api.requestRedraw,
    registerLayer: () => () => {},
    subscribeFrame: api.subscribeFrame,
  });

  return () => {
    // Widgets outlive the attachment. Leaving one believing the pointer is
    // still over it strands it painted as hovered, and a re-attach starts
    // with an empty `lastHovered` so it never sees the leave.
    if (lastHovered) {
      lastHovered.onPointer({ type: 'hoverleave', native: null } satisfies HudPointerEvent);
      lastHovered = null;
    }
    detachFocus();
    detachLayer();
    hud.unbind();
  };
}

const RING_WIDTH = 2;
const RING_GAP = 2;

/** A stroked rect just outside `w`'s bounds, so the ring never covers the
 *  widget's own edge. */
function focusRing(w: Widget, color: string): DrawCommand {
  const { x, y, w: bw, h } = w.bounds;
  const out = RING_GAP + RING_WIDTH / 2;
  return {
    kind: 'path',
    path: { kind: 'rect', x: x - out, y: y - out, width: bw + out * 2, height: h + out * 2 },
    stroke: { paint: { fill: 'solid', color }, width: RING_WIDTH },
  };
}

function keyEvent(e: KeyboardEvent, type: HudKeyEvent['type']): HudKeyEvent {
  return {
    type, key: e.key, code: e.code,
    altKey: e.altKey, ctrlKey: e.ctrlKey, metaKey: e.metaKey, shiftKey: e.shiftKey,
    repeat: e.repeat, native: e,
  };
}

/**
 * The DOM half of HUD focus, on the element that holds the canvas's DOM
 * focus. Keys are heard there, at the target, which is ahead of the gesture
 * dispatcher's `window` listener: a key the focused widget handles is
 * `preventDefault`ed, and the dispatcher skips any key that arrives that way.
 */
function wireFocus(
  element: HTMLElement,
  hud: Hud,
  hitAt: (sx: number, sy: number) => Widget | null,
): () => void {
  const onPointerDown = (e: PointerEvent) => {
    const r = element.getBoundingClientRect();
    const hit = hitAt(e.clientX - r.left, e.clientY - r.top);
    hud.focus(hit && isFocusable(hit) ? hit : null, { visible: false });
  };

  const liveFocused = (): Widget | null => {
    const f = hud.focused;
    if (f && !isFocusable(f)) { hud.focus(null); return null; }
    return f;
  };

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.defaultPrevented) return;
    const f = liveFocused();
    // Any key on a focused widget means the keyboard is in use: show the ring.
    if (f && !hud.focusVisible) hud.focus(f, { visible: true });
    if (f?.onKey?.(keyEvent(e, 'keydown'))) { e.preventDefault(); return; }
    if (e.key !== 'Tab' || e.ctrlKey || e.metaKey || e.altKey) return;
    const direction = e.shiftKey ? 'prev' : 'next';
    // Backward from the canvas itself, and forward off the last widget, are
    // the browser's: focus leaves the canvas. Backward off the first widget
    // lands on the canvas, which is a stop of its own.
    if (f === null && direction === 'prev') return;
    const next = hud.moveFocus(direction);
    if (next !== null || direction === 'prev') e.preventDefault();
  };

  const onKeyUp = (e: KeyboardEvent) => {
    if (e.defaultPrevented) return;
    if (liveFocused()?.onKey?.(keyEvent(e, 'keyup'))) e.preventDefault();
  };

  const onBlur = () => { hud.focus(null); };

  const region = createLiveRegion(element.ownerDocument);
  const unsubscribe = hud.subscribeFocus((w) => {
    region.textContent = w?.accessibleName ?? '';
  });

  element.addEventListener('pointerdown', onPointerDown);
  element.addEventListener('keydown', onKeyDown);
  element.addEventListener('keyup', onKeyUp);
  element.addEventListener('blur', onBlur);
  return () => {
    element.removeEventListener('pointerdown', onPointerDown);
    element.removeEventListener('keydown', onKeyDown);
    element.removeEventListener('keyup', onKeyUp);
    element.removeEventListener('blur', onBlur);
    unsubscribe();
    region.remove();
  };
}

/** A polite live region, visually hidden, that names the focused widget. The
 *  widgets are pixels with no DOM of their own, so there is nothing for
 *  `aria-activedescendant` to point at; announcing is the lightest correct
 *  way to tell assistive tech where focus went. */
function createLiveRegion(doc: Document): HTMLElement {
  const el = doc.createElement('div');
  el.setAttribute('aria-live', 'polite');
  el.setAttribute('aria-atomic', 'true');
  el.dataset.weaselHud = 'focus';
  // No stylesheet ships with this package; these are the standard
  // visually-hidden declarations, on an element only this code owns.
  Object.assign(el.style, {
    position: 'absolute', width: '1px', height: '1px', margin: '-1px', padding: '0',
    overflow: 'hidden', clip: 'rect(0 0 0 0)', whiteSpace: 'nowrap', border: '0',
  });
  doc.body.appendChild(el);
  return el;
}
