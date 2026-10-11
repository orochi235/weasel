import { useEffect, useId, useState, type RefObject } from 'react';

const CONTROLS = 'input, select, textarea, button, [tabindex]:not([tabindex="-1"])';

/** How long keyboard focus rests on a row's control before its help opens. */
const FOCUS_DELAY = 600;

/** What {@link useRowHelp} hands the help it serves. */
export interface RowHelp {
  /** The id of the element holding the help's text, which the row's control is described by. */
  id: string;
  open: boolean;
  setOpen: (open: boolean) => void;
}

/**
 * A row's help with no tab stop of its own. The row is the ancestor of `cue` that `within` selects, and what
 * shares the cue's parent (the label, an auto toggle) is the row's own. The first control outside that is
 * described by the help's text, so a screen reader reads it with the control, and the help opens when the
 * keyboard brings focus to a control in the row, so a reader with no pointer sees it. With no `within` it does
 * nothing.
 */
export function useRowHelp(cue: RefObject<HTMLElement | null>, within: string | undefined): RowHelp {
  const id = useId();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const row = within === undefined ? null : cue.current?.closest(within);
    if (!row) return;
    const ids = (el: Element): string[] =>
      (el.getAttribute('aria-describedby') ?? '').split(/\s+/).filter((x) => x !== '' && x !== id);
    let described: Element | undefined;
    const release = (): void => {
      if (!described) return;
      const rest = ids(described);
      if (rest.length > 0) described.setAttribute('aria-describedby', rest.join(' '));
      else described.removeAttribute('aria-describedby');
      described = undefined;
    };
    const describe = (): void => {
      const own = cue.current?.parentElement;
      const first = [...row.querySelectorAll(CONTROLS)].find((el) => !own?.contains(el));
      if (first !== described) release();
      described = first;
      if (first && !first.getAttribute('aria-describedby')?.split(/\s+/).includes(id)) {
        first.setAttribute('aria-describedby', [...ids(first), id].join(' '));
      }
    };
    describe();
    // The control is the row's children: it may arrive, leave or be replaced, and one that sets its own
    // description on a later render writes over this one.
    const watch = new MutationObserver(describe);
    watch.observe(row, { childList: true, subtree: true, attributes: true, attributeFilter: ['aria-describedby'] });
    let timer: ReturnType<typeof setTimeout> | undefined;
    // A press in the row is what brought the focus that follows it. `:focus-visible` cannot say so: a text field
    // matches it however it was focused.
    let pressed = false;
    const onFocus = (e: Event): void => {
      if (pressed || cue.current?.parentElement?.contains(e.target as Node)) return;
      clearTimeout(timer);
      timer = setTimeout(() => setOpen(true), FOCUS_DELAY);
    };
    const onBlur = (e: Event): void => {
      if (row.contains((e as FocusEvent).relatedTarget as Node | null)) return;
      pressed = false;
      clearTimeout(timer);
      setOpen(false);
    };
    const onDown = (): void => {
      pressed = true;
    };
    const onUp = (): void => {
      pressed = false;
    };
    row.addEventListener('focusin', onFocus);
    row.addEventListener('focusout', onBlur);
    row.addEventListener('pointerdown', onDown);
    row.addEventListener('pointerup', onUp);
    return () => {
      watch.disconnect();
      release();
      clearTimeout(timer);
      row.removeEventListener('focusin', onFocus);
      row.removeEventListener('focusout', onBlur);
      row.removeEventListener('pointerdown', onDown);
      row.removeEventListener('pointerup', onUp);
    };
  }, [cue, within, id]);

  return { id, open, setOpen };
}
