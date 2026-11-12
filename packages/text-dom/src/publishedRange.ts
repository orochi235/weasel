/** The range an edit publishes: where its caret or selection is, and the styling the overlay carries across it. */
import { useCallback, useRef, useState } from 'react';
import { styleAtRange, type RangeStyle, type StyledRun } from '@weasel-js/text';
import { domToRuns } from './domRuns';
import { readSelectionOffsets, sameSelection } from './overlaySelection';
import { runStyleAt } from './runSplice';
import type { TextEditSelection } from './textEditTypes';

/** The styling at a collapsed caret, read as a range: `runStyleAt`'s, which the next typed character takes. */
export function styleAtCaret(runs: readonly StyledRun[], at: number): RangeStyle {
  return runs.some((r) => r.text.length > 0) ? styleAtRange([{ ...runStyleAt(runs, at), text: ' ' }], 0, 1) : {};
}

/**
 * The published range and its styling, for an overlay `overlayRef` holds, and the style armed at the caret, which
 * any range but the caret it was armed at abandons.
 */
export function usePublishedRange(
  overlayRef: { readonly current: HTMLElement | null },
  pendingAtRef: { readonly current: number | null },
  dropPending: () => void,
) {
  const [selection, setSelection] = useState<TextEditSelection | null>(null);
  const [rangeStyle, setRangeStyle] = useState<RangeStyle | null>(null);
  /** The published range, mirrored in a ref: the fallback when the DOM
   *  selection has moved into editing chrome. */
  const selectionRef = useRef<TextEditSelection | null>(null);

  /** Publish `range` and the styling the overlay currently carries across it. */
  const publishRange = useCallback((overlay: HTMLElement, range: TextEditSelection) => {
    const collapsed = range.start === range.end;
    // A pending style belongs to the caret position it was armed at. Any
    // other range means the caret moved, which abandons it.
    if (pendingAtRef.current !== null
      && !(collapsed && range.start === pendingAtRef.current)) {
      dropPending();
    }
    selectionRef.current = range;
    setSelection((prev) => (sameSelection(prev, range) ? prev : range));
    const runs = domToRuns(overlay);
    setRangeStyle(collapsed
      ? styleAtCaret(runs, range.start)
      : styleAtRange(runs, range.start, range.end));
  }, [dropPending, pendingAtRef]);

  const syncSelection = useCallback(() => {
    const overlay = overlayRef.current;
    if (!overlay) return;
    const next = readSelectionOffsets(overlay);
    // A selection outside the overlay means focus moved into a control, which
    // is when the range matters most: leave it published rather than clear it.
    if (next === null) return;
    publishRange(overlay, next);
  }, [publishRange, overlayRef]);

  /** Drop the published range — the edit session it described is over. */
  const clearSelection = useCallback(() => {
    selectionRef.current = null;
    setSelection(null);
    setRangeStyle(null);
    dropPending();
  }, [dropPending]);

  return { selection, rangeStyle, selectionRef, publishRange, syncSelection, clearSelection };
}
