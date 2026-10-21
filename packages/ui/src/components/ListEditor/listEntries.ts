import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { useReorderDragList, type ReorderItem } from '../../useReorderDragList';

/** Where focus goes once the list has committed an edit. `removed`: the entry that held it is gone. */
export type FocusRequest = { at: number; to: 'input' | 'handle' | 'removed' };

/** Refs for each entry's focusable parts, and a request that moves focus once an edit has rendered. */
export function useListFocus() {
  const inputs = useRef<(HTMLInputElement | null)[]>([]);
  const handles = useRef<(HTMLButtonElement | null)[]>([]);
  const removes = useRef<(HTMLButtonElement | null)[]>([]);
  const add = useRef<HTMLButtonElement | null>(null);
  const [focus, setFocus] = useState<FocusRequest | null>(null);

  useEffect(() => {
    if (focus === null) return;
    const { at, to } = focus;
    const input = inputs.current[at];
    if (to === 'handle') handles.current[at]?.focus();
    else if (input) input.focus();
    else if (to === 'removed') {
      const beside = removes.current[at];
      (beside && !beside.disabled ? beside : add.current)?.focus();
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect -- consumes a one-shot focus request once its input has committed
    setFocus(null);
  }, [focus]);

  return { inputs, handles, removes, add, request: setFocus };
}

/** `list` with the entry at `from` taken out and put back in front of what was at `target`. */
export function movedEntry<T>(list: readonly T[], from: number, target: number): T[] {
  const out = list.filter((_, i) => i !== from);
  out.splice(target > from ? target - 1 : target, 0, list[from] as T);
  return out;
}

const isMove = (e: KeyboardEvent): boolean => e.altKey && (e.key === 'ArrowUp' || e.key === 'ArrowDown');

/**
 * How a list's entries move: `drag` for each entry's handle, and `move` for Alt+Up / Alt+Down anywhere in an
 * entry. Focus follows the entry, into its text field when it was there, and onto its handle otherwise.
 */
export function useEntryMoves<T>(
  value: readonly T[],
  onChange: (next: T[]) => void,
  focus: ReturnType<typeof useListFocus>,
  enabled: boolean,
) {
  const items = useMemo((): ReorderItem[] => value.map((_, i) => ({ id: String(i), label: '' })), [value]);
  const drag = useReorderDragList({
    items,
    selectedIds: [],
    onReorder: ([id], target) => {
      const from = Number(id);
      onChange(movedEntry(value, from, target));
      focus.request({ at: target > from ? target - 1 : target, to: 'handle' });
    },
  });
  const move = (e: KeyboardEvent, at: number): void => {
    if (!enabled || !isMove(e)) return;
    e.preventDefault();
    const by = e.key === 'ArrowUp' ? -1 : 1;
    const to = at + by;
    if (to < 0 || to >= value.length) return;
    onChange(movedEntry(value, at, by < 0 ? to : to + 1));
    focus.request({ at: to, to: e.target === focus.inputs.current[at] ? 'input' : 'handle' });
  };
  return { drag, move };
}
