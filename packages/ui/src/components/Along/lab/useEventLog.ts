import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';

/** One logged event: when, what, on what, and whether something on the way claimed it with `preventDefault`. */
export interface LoggedEvent {
  id: number;
  at: number;
  type: string;
  target: string;
  detail: string;
  claimed: boolean;
  /** How many like events this line stands for: a run of moves is one line. */
  count: number;
}

/** The kinds of event the log takes, by group. */
export const LOGGED = {
  pointer: ['pointerdown', 'pointerup', 'pointercancel', 'click', 'contextmenu', 'gotpointercapture', 'lostpointercapture'],
  moves: ['pointermove'],
  wheel: ['wheel'],
  focus: ['focusin', 'focusout'],
  keys: ['keydown'],
} as const;

export type LogGroup = keyof typeof LOGGED;

/** At most this many lines are kept; older ones fall off the end. */
export const LOG_LIMIT = 200;

/** A short name for what `el` is, read from the attributes the arc controls put on their parts. */
export function describe(el: EventTarget | null): string {
  if (!(el instanceof Element)) return String(el);
  if (el.closest('[data-slider-band]')) return 'slider band';
  const item = el.closest('[data-bar-item], [data-bar-more], [data-bar-lead]');
  const named = el.closest('[aria-label], button, [role]');
  if (named) {
    const role = named.getAttribute('role') ?? named.tagName.toLowerCase();
    const name = named.getAttribute('aria-label') ?? named.textContent?.trim().slice(0, 24) ?? '';
    return name ? `${role} "${name}"` : role;
  }
  if (item) return `bar item ${item.getAttribute('data-bar-item') ?? 'more'}`;
  return el.tagName.toLowerCase();
}

function detailOf(e: Event): string {
  if (e instanceof WheelEvent) return `dy ${Math.round(e.deltaY)}`;
  if (e instanceof KeyboardEvent) return `${e.shiftKey ? 'Shift+' : ''}${e.key}`;
  if (e instanceof PointerEvent) return `${e.pointerType} #${e.pointerId}`;
  if (e instanceof FocusEvent) return e.relatedTarget ? `from ${describe(e.relatedTarget)}` : '';
  return '';
}

/**
 * Every event of the `groups` asked for that reaches anything inside `root`, logged as it passes on the way down
 * (capture), with whether anything had claimed it once it finished. Newest first, `LOG_LIMIT` lines at most.
 */
export function useEventLog(root: RefObject<HTMLElement | null>, groups: readonly LogGroup[]) {
  const [log, setLog] = useState<LoggedEvent[]>([]);
  const next = useRef(1);
  const start = useRef(0);
  // The newest line, read as the event arrives: a move folds into it, and is claimed on it, before the log renders.
  const newest = useRef<LoggedEvent | null>(null);
  const key = groups.join(',');

  useEffect(() => {
    const el = root.current;
    if (!el) return;
    start.current = start.current || performance.now();
    const types = key.split(',').flatMap((g) => LOGGED[g as LogGroup] ?? []);
    const onEvent = (e: Event): void => {
      const at = Math.round(e.timeStamp - start.current);
      const target = describe(e.target);
      const top = newest.current;
      const folds = top !== null && e.type === 'pointermove' && top.type === 'pointermove' && top.target === target;
      const id = folds ? top.id : next.current++;
      if (folds) setLog((prev) => (prev[0]?.id === id ? [{ ...prev[0], count: prev[0].count + 1, at }, ...prev.slice(1)] : prev));
      else {
        const line: LoggedEvent = { id, at, type: e.type, target, detail: detailOf(e), claimed: false, count: 1 };
        newest.current = line;
        setLog((prev) => [line, ...prev].slice(0, LOG_LIMIT));
      }
      // Read once every handler has run: this one sees the event on its way down, before anything has claimed it.
      setTimeout(() => {
        if (e.defaultPrevented) setLog((prev) => prev.map((l) => (l.id === id ? { ...l, claimed: true } : l)));
      }, 0);
    };
    for (const t of types) el.addEventListener(t, onEvent, { capture: true, passive: true });
    return () => {
      for (const t of types) el.removeEventListener(t, onEvent, { capture: true });
    };
  }, [root, key]);

  const clear = useCallback(() => {
    newest.current = null;
    setLog([]);
  }, []);
  return { log, clear };
}

/** What Tab steps through inside `root`, in the order it does: every enabled, shown, tabbable element in document order. */
export function tabOrder(root: HTMLElement): HTMLElement[] {
  const all = [...root.querySelectorAll<HTMLElement>('a[href], button, input, select, textarea, [tabindex]')];
  const ok = all.filter((el) => el.tabIndex >= 0 && !(el as HTMLButtonElement).disabled && el.getClientRects().length > 0 && getComputedStyle(el).visibility !== 'hidden');
  const positive = ok.filter((el) => el.tabIndex > 0).sort((a, b) => a.tabIndex - b.tabIndex);
  return [...positive, ...ok.filter((el) => el.tabIndex === 0)];
}
