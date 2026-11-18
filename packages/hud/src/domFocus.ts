import type { Hud } from './hud';
import { clientToCanvas } from '@weasel-js/core';
import { isFocusable, type HudKeyEvent, type Widget } from './widget';
import { hideVisually, mirrorFocusedTree } from './accessibleMirror';
import { wireTextInput } from './textInputHost';

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
export function wireFocus(
  element: HTMLElement,
  hud: Hud,
  hitAt: (sx: number, sy: number) => Widget | null,
): () => void {
  const onPointerDown = (e: PointerEvent) => {
    const hit = hitAt(...clientToCanvas(element, e.clientX, e.clientY));
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

  // Keys and DOM focus on the hidden input a widget's text edit types through count as the canvas's.
  const text = wireTextInput(element, hud, { keydown: onKeyDown, keyup: onKeyUp, blur: () => { hud.focus(null); } });
  const onBlur = (e: FocusEvent) => { if (e.relatedTarget !== text.input) hud.focus(null); };

  const region = createLiveRegion(element.ownerDocument);
  const announce = () => {
    const name = hud.focused?.accessibleName ?? '';
    if (region.textContent !== name) region.textContent = name;
  };
  const unsubscribe = hud.subscribeFocus((w) => {
    region.textContent = w?.accessibleName ?? '';
  });
  // A widget's change, a button's new label among them, is drawn on the next frame; its name is read there too.
  const unannounce = hud.subscribeFrame(announce);
  const unmirror = mirrorFocusedTree(element, hud);

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
    unannounce();
    unmirror();
    text.detach();
    region.remove();
  };
}

/** A polite live region, visually hidden, that names the focused widget. A widget that has
 *  insides to show declares an `accessibleTree`, which `mirrorFocusedTree` puts in the DOM. */
function createLiveRegion(doc: Document): HTMLElement {
  const el = doc.createElement('div');
  el.setAttribute('aria-live', 'polite');
  el.setAttribute('aria-atomic', 'true');
  el.dataset.weaselHud = 'focus';
  hideVisually(el);
  doc.body.appendChild(el);
  return el;
}
