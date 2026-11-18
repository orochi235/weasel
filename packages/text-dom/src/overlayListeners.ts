/**
 * The events an open edit listens for: its keys that end, step or restyle it, leaving it by blur or by a press
 * outside, typing, and the document's selection.
 */
import { historyKey } from '@weasel-js/gestures';
import { editEnd, imeKey } from '@weasel-js/ui-input';
import type { OverlayHistory } from './overlayHistory';
import type { typingHandlers } from './overlayTyping';
import { toggleForKey } from './styleShortcuts';
import type { StyleToggle, UseTextEditOptions } from './textEditTypes';

/** What the listeners act on. */
export interface OverlayListenerHost {
  readonly optsRef: { readonly current: Pick<UseTextEditOptions, 'escape' | 'isEditorChrome'> };
  commit(): void;
  cancel(): void;
  readonly history: Pick<OverlayHistory, 'undo' | 'redo'>;
  toggleStyle(toggle: StyleToggle): void;
  readonly typing: ReturnType<typeof typingHandlers>;
  syncSelection(): void;
}

/** Listen on `overlay`, mounted in `scroll`, and on the document; returns what stops listening. */
export function listenToOverlay(
  overlay: HTMLElement,
  scroll: HTMLElement,
  host: OverlayListenerHost,
): () => void {
  const { optsRef, commit, history, typing, syncSelection } = host;
  const onKeyDown = (e: KeyboardEvent) => {
    if (imeKey(e)) return;
    const ends = editEnd({ key: e.key, shift: e.shiftKey }, { escape: optsRef.current.escape, multiline: true });
    if (ends) {
      e.preventDefault();
      if (ends === 'commit') commit();
      else host.cancel();
      return;
    }
    const step = historyKey(e);
    if (step) {
      e.preventDefault();
      history[step]();
      return;
    }
    const toggle = toggleForKey(e);
    if (toggle) {
      e.preventDefault();
      host.toggleStyle(toggle);
    }
  };
  const onBlur = (e: FocusEvent) => {
    const next = e.relatedTarget;
    if (isChrome(optsRef.current, next)) return;
    commit();
  };

  // Blur can't be the only way out: once focus has moved into editing
  // chrome, nothing blurs when the user clicks away. Capture phase so this
  // runs ahead of whatever the click was aimed at.
  const onPointerDownOutside = (e: Event) => {
    const target = e.target;
    if (!(target instanceof Node) || scroll.contains(target)) return;
    if (isChrome(optsRef.current, target)) return;
    commit();
  };

  const listeners = Object.entries({
    keydown: onKeyDown, blur: onBlur, input: typing.onInput, beforeinput: typing.onBeforeInput,
    compositionstart: typing.onCompositionStart, compositionend: typing.onCompositionEnd,
  }) as Array<[string, EventListener]>;
  for (const [type, fn] of listeners) overlay.addEventListener(type, fn);
  document.addEventListener('pointerdown', onPointerDownOutside, true);
  // `selectionchange` only exists on the document.
  document.addEventListener('selectionchange', syncSelection);

  return () => {
    for (const [type, fn] of listeners) overlay.removeEventListener(type, fn);
    document.removeEventListener('pointerdown', onPointerDownOutside, true);
    document.removeEventListener('selectionchange', syncSelection);
  };
}

function isChrome(opts: Pick<UseTextEditOptions, 'isEditorChrome'>, el: EventTarget | null): boolean {
  return el instanceof Element && (opts.isEditorChrome?.(el) ?? false);
}
