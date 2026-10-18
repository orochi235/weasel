import { useEffect, useRef, useState } from 'react';

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
