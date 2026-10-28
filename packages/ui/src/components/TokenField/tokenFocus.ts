import { useEffect, useRef, useState } from 'react';

/** Where focus goes once the field has rendered an edit: a chip by index, or the text field. */
export type TokenFocusRequest = number | 'input';

/** A chip's focusable part: the label that takes its action, not its remove button. */
export function labelOf(chip: HTMLElement | null | undefined): HTMLElement | null {
  return chip?.querySelector<HTMLElement>('[role="button"], [tabindex="0"]') ?? null;
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
