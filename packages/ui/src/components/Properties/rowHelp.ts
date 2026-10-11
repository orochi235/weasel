import { useEffect, useId, useRef, useState, type FocusEvent, type RefObject } from 'react';

const CONTROLS = 'input, select, textarea, button, [tabindex]:not([tabindex="-1"])';

/** How long keyboard focus rests on a row's control before its help opens: the tooltip's own hover delay. */
const FOCUS_DELAY = 600;

/** What {@link useRowHelp} hands a row. */
export interface RowHelp {
  /** The id of the element holding the help's text, which the row's control is described by. */
  id: string;
  /** Whether a control in the row carries the help. Until one does, the ⓘ keeps its place in the tab order. */
  carried: boolean;
  open: boolean;
  setOpen: (open: boolean) => void;
  onFocus: (e: FocusEvent) => void;
  onBlur: (e: FocusEvent) => void;
  onPointerDown: () => void;
  onPointerUp: () => void;
}

/**
 * A row's help without a tab stop of its own. The row's first control is described by the help's text, so a
 * screen reader reads it with the control, and the tooltip opens when the keyboard brings focus to a control in
 * the row, so a sighted reader with no pointer sees it. `label` holds the controls that are the row's own (the ⓘ,
 * an auto toggle), which carry nothing.
 */
export function useRowHelp(
  row: RefObject<HTMLElement | null>,
  label: RefObject<HTMLElement | null>,
  has: boolean,
): RowHelp {
  const id = useId();
  const [carried, setCarried] = useState(false);
  const [open, setOpen] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  // A press in the row is what brought the focus that follows it. `:focus-visible` cannot say so: a text field
  // matches it however it was focused.
  const pressed = useRef(false);

  // Every render: the control is the row's children, which may arrive, leave or be replaced at any of them.
  // eslint-disable-next-line react-hooks/exhaustive-deps -- so no dependency list; `setCarried` settles on a value
  useEffect(() => {
    const first = has
      ? [...(row.current?.querySelectorAll(CONTROLS) ?? [])].find((el) => !label.current?.contains(el))
      : undefined;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reads the DOM the row's children drew, which nothing reports
    setCarried(first !== undefined);
    if (first === undefined) return;
    const others = (first.getAttribute('aria-describedby') ?? '').split(/\s+/).filter((x) => x !== '' && x !== id);
    first.setAttribute('aria-describedby', [...others, id].join(' '));
    return () => {
      const rest = (first.getAttribute('aria-describedby') ?? '').split(/\s+/).filter((x) => x !== '' && x !== id);
      if (rest.length > 0) first.setAttribute('aria-describedby', rest.join(' '));
      else first.removeAttribute('aria-describedby');
    };
  });
  useEffect(() => () => clearTimeout(timer.current), []);

  return {
    id,
    carried,
    open,
    setOpen,
    onFocus: (e) => {
      if (!carried || pressed.current || label.current?.contains(e.target)) return;
      clearTimeout(timer.current);
      timer.current = setTimeout(() => setOpen(true), FOCUS_DELAY);
    },
    onBlur: (e) => {
      if (row.current?.contains(e.relatedTarget)) return;
      pressed.current = false;
      clearTimeout(timer.current);
      setOpen(false);
    },
    onPointerDown: () => {
      pressed.current = true;
    },
    onPointerUp: () => {
      pressed.current = false;
    },
  };
}
