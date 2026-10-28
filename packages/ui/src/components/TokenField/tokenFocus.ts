import { useEffect, useRef, useState } from 'react';

/** Where focus goes once the field has rendered an edit: a chip by index, or the text field. */
export type TokenFocusRequest = number | 'input';

/** A chip's focusable part: the label that takes its action, not its remove button. */
export function labelOf(chip: HTMLElement | null | undefined): HTMLElement | null {
  return chip?.querySelector<HTMLElement>('[role="button"], [tabindex="0"]') ?? null;
}

/** What a key on a focused chip does: move focus or the chip itself one place, or remove the chip. */
export type ChipKey = { kind: 'focus' | 'move'; by: -1 | 1 } | { kind: 'remove' };

/** The {@link ChipKey} a key press means: Left and Right move focus, with Alt the chip; Backspace and Delete remove. */
export function chipKey(e: { key: string; altKey: boolean }): ChipKey | null {
  const by = e.key === 'ArrowLeft' ? -1 : e.key === 'ArrowRight' ? 1 : 0;
  if (by !== 0) return { kind: e.altKey ? 'move' : 'focus', by };
  return e.key === 'Backspace' || e.key === 'Delete' ? { kind: 'remove' } : null;
}

/** Refs for each chip and the text field, and a request that moves focus once an edit has rendered. */
export function useTokenFocus() {
  const chips = useRef<(HTMLElement | null)[]>([]);
  const input = useRef<HTMLInputElement | null>(null);
  const [at, request] = useState<TokenFocusRequest | null>(null);

  useEffect(() => {
    if (at === null) return;
    if (at === 'input') input.current?.focus();
    else (labelOf(chips.current[at]) ?? input.current)?.focus();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- consumes a one-shot focus request once its edit has committed
    request(null);
  }, [at]);

  return { chips, input, request };
}
