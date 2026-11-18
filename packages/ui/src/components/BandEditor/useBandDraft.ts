import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { openPointerSession, type PointerSession } from '@weasel-js/routing';
import { withSeams, type Band, type RangeEdge } from './bands';
import { sameSeams, seamGhost } from './seamGhost';
import type { DraftGhostAt } from './DraftGhost';
import type { RangeEdit } from './RangeEdgeHandle';

/** A drag under way: the bands and range as the pointer has them, which edges it took from where, and the bands
 *  it began from, which a commit is measured against however the caller previewed it. */
export type Draft<T> = {
  bands: Band<T>[];
  range?: [number, number];
  ghost: DraftGhostAt;
  from?: Band<T>[];
};

/** What the drafts read, all of it as of this render. Callbacks take untagged bands. */
export interface BandDraftInputs<T> {
  committed: Band<T>[];
  min: number;
  max: number;
  onInput?: (next: Band<T>[]) => void;
  onChange: (next: Band<T>[]) => void;
  onCancel?: () => void;
  onRangeInput?: (min: number, max: number, bands: Band<T>[]) => void;
  onRangeChange?: (min: number, max: number, bands: Band<T>[]) => void;
}

/** `from` with its seams at `seams`, or null where that moves none of them. */
function seamsMoved<T>(from: Band<T>[], seams: number[]): Band<T>[] | null {
  const next = withSeams(from, seams);
  return sameSeams(next, from) ? null : next;
}

/**
 * A band editor's drags: the draft a seam, band or edge drag draws from until it ends, the pointer session an
 * edge drag runs in, and the input, commit and cancel each kind of drag sends.
 */
export function useBandDraft<T>(inputs: BandDraftInputs<T>) {
  const { committed, min, max, onInput, onChange } = inputs;
  const sessionRef = useRef<PointerSession | null>(null);
  useEffect(() => () => { sessionRef.current?.cancel(); }, []);
  const [draft, setDraftState] = useState<Draft<T> | null>(null);
  // Read by the handlers: a second pointermove can land before the render the first one scheduled.
  const draftRef = useRef<Draft<T> | null>(null);
  const setDraft = (next: Draft<T> | null): void => {
    draftRef.current = next;
    setDraftState(next);
  };

  // An edge drag, which a second finger's press leaves to the first. One canceled puts its preview back.
  const drag = (down: ReactPointerEvent<HTMLElement>, onMove: (ev: PointerEvent) => void, onEnd: () => void): void => {
    if (sessionRef.current?.active) return;
    sessionRef.current = openPointerSession(down.currentTarget, down, {
      onMove,
      onEnd: () => { sessionRef.current = null; setDraft(null); onEnd(); },
      onCancel: () => {
        sessionRef.current = null;
        if (draftRef.current) { inputs.onRangeInput?.(min, max, committed); inputs.onCancel?.(); }
        setDraft(null);
      },
    }, { capture: false, escape: true });
  };

  const seamInput = (seams: number[]): void => {
    const next = withSeams(committed, seams);
    const current = draftRef.current;
    if (sameSeams(next, current?.bands ?? committed)) return;
    const ghost = current?.ghost ?? seamGhost(committed, next, min, max);
    if (!ghost) return;
    setDraft({ bands: next, ghost, from: current?.from ?? committed });
    onInput?.(next);
  };
  const seamCommit = (seams: number[]): void => {
    const next = seamsMoved(draftRef.current?.from ?? committed, seams);
    setDraft(null);
    if (next) onChange(next);
  };
  const seamCancel = (): void => { setDraft(null); inputs.onCancel?.(); };

  const rangeInput = (edge: RangeEdge, edit: RangeEdit<T>): void => {
    setDraft({ bands: edit.bands, range: edit.range, ghost: { at: edge === 'min' ? min : max } });
    inputs.onRangeInput?.(edit.range[0], edit.range[1], edit.bands);
  };
  const rangeCommit = (edit: RangeEdit<T>): void => {
    inputs.onRangeChange?.(edit.range[0], edit.range[1], edit.bands);
  };

  return { draft, drag, seamInput, seamCommit, seamCancel, rangeInput, rangeCommit };
}
