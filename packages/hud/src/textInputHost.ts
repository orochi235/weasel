import { imeKey } from '@weasel-js/headless';
import type { Hud } from './hud';
import { isFocusable, type HudTextInput, type Widget } from './widget';

/** What the hidden input hands back to the canvas's own focus wiring. */
export interface TextInputHandlers {
  keydown(e: KeyboardEvent): void;
  keyup(e: KeyboardEvent): void;
  /** DOM focus left both the input and the canvas. */
  blur(): void;
}

/**
 * A hidden `<input>` that holds DOM focus in place of `element`, the canvas, while the focused widget's
 * {@link HudTextInput} has an edit running, so an input method composes into it. It sits over the edit's caret,
 * where the platform puts its candidate window. Keys on it go to `on`'s handlers, as the canvas's would; composition
 * goes to the widget. Returns the input and a detach.
 */
export function wireTextInput(element: HTMLElement, hud: Hud, on: TextInputHandlers): { input: HTMLInputElement; detach(): void } {
  const doc = element.ownerDocument;
  const input = doc.createElement('input');
  input.type = 'text';
  input.tabIndex = -1;
  input.autocomplete = 'off';
  input.spellcheck = false;
  input.setAttribute('autocapitalize', 'off');
  input.dataset.weaselHud = 'text-input';
  Object.assign(input.style, {
    position: 'fixed', left: '0', top: '0', width: '1px', height: '1px', margin: '0', padding: '0', border: '0',
    outline: 'none', opacity: '0', background: 'transparent', color: 'transparent', caretColor: 'transparent',
    pointerEvents: 'none',
  });
  doc.body.appendChild(input);

  let source: { widget: Widget; text: HudTextInput; off(): void } | null = null;
  const target = () => source?.text;

  const release = () => {
    input.value = '';
    if (doc.activeElement === input) element.focus({ preventScroll: true });
  };

  const sync = () => {
    const w = hud.focused;
    const state = w && source?.widget === w && isFocusable(w) ? source.text.read() : null;
    if (!state) { release(); return; }
    const box = element.getBoundingClientRect();
    Object.assign(input.style, {
      left: `${box.left + state.rect.x}px`, top: `${box.top + state.rect.y}px`,
      width: `${state.rect.w}px`, height: `${state.rect.h}px`,
    });
    if (state.label) input.setAttribute('aria-label', state.label);
    else input.removeAttribute('aria-label');
    // Only focus the canvas held is handed on: a widget focused from code while the page's focus is elsewhere
    // must not pull it in.
    if (doc.activeElement === element) input.focus({ preventScroll: true });
  };

  const follow = (w: Widget | null) => {
    source?.off();
    source = null;
    const text = w?.textInput;
    if (w && text) source = { widget: w, text, off: text.subscribe(sync) };
    sync();
  };

  const onKeyDown = (e: KeyboardEvent) => { if (!imeKey(e)) on.keydown(e); };
  const onKeyUp = (e: KeyboardEvent) => { if (!imeKey(e)) on.keyup(e); };
  const onUpdate = (e: CompositionEvent) => { target()?.compose(e.data); };
  const onEnd = (e: CompositionEvent) => {
    const t = target();
    if (e.data) t?.insert(e.data);
    else t?.compose('');
    input.value = '';
  };
  // Text that arrives with no key and no composition, as from the platform's character picker.
  const onInput = (e: Event) => {
    const ie = e as InputEvent;
    if (ie.isComposing) return;
    if (ie.inputType === 'insertText' && ie.data) target()?.insert(ie.data);
    input.value = '';
  };
  const onBlur = (e: FocusEvent) => {
    target()?.compose('');
    if (e.relatedTarget !== element) on.blur();
  };
  // A press on the canvas takes DOM focus back to it, mid-edit.
  const onElementFocus = () => { sync(); };

  input.addEventListener('keydown', onKeyDown);
  input.addEventListener('keyup', onKeyUp);
  input.addEventListener('compositionupdate', onUpdate);
  input.addEventListener('compositionend', onEnd);
  input.addEventListener('input', onInput);
  input.addEventListener('blur', onBlur);
  element.addEventListener('focus', onElementFocus);
  const unfocus = hud.subscribeFocus(follow);
  follow(hud.focused);

  return {
    input,
    detach() {
      unfocus();
      source?.off();
      source = null;
      element.removeEventListener('focus', onElementFocus);
      release();
      input.remove();
    },
  };
}
