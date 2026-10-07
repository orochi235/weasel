import { useLatest } from '@weasel-js/core';
import { type RefObject, useLayoutEffect, useRef } from 'react';
import { fitStage } from '../canvas/Stage';
import type { ViewportSize } from '../canvas/worldSpec';
import type { Instrument, ViewTransform } from '../instrument/types';

/** The view `instrument` opens on in a viewport of `size`, or `null` when where
 *  it opens does not depend on the size. */
function sizedInitialView(instrument: Instrument, size: ViewportSize): ViewTransform | null {
  const stage = instrument.canvas ? undefined : instrument.stage;
  const declared =
    instrument.canvas?.initialView ??
    (stage ? (stage.initialView ?? ((vp: ViewportSize) => fitStage(stage.size, vp))) : undefined);
  return typeof declared === 'function' ? declared(size) : null;
}

function measure(el: HTMLElement | null): ViewportSize | null {
  const r = el?.getBoundingClientRect();
  return r && r.width > 0 && r.height > 0 ? { width: r.width, height: r.height } : null;
}

interface ViewPlacementOptions {
  instrument: Instrument;
  view: unknown;
  setView: (view: unknown) => void;
  /** Whether the trial is the one its lab is presenting. */
  presented: boolean;
  /** The element the trial's camera fills. */
  viewport: RefObject<HTMLElement | null>;
}

/**
 * Places a trial's view where its instrument's `initialView` needs the
 * viewport's size: on the first measurement while the view is `null` — the
 * unplaced marker, which reset writes too — and again on entering
 * presentation, for the presented box. Leaving gives the tile back the view it
 * had. Returns the handler for each measurement.
 */
export function useViewPlacement({
  instrument,
  view,
  setView,
  presented,
  viewport,
}: ViewPlacementOptions): (size: ViewportSize) => void {
  const latest = useLatest({ instrument, view, setView });
  // The tile's view while presented; `undefined` when nothing was refitted.
  const tileView = useRef<unknown>(undefined);
  const wasPresented = useRef(presented);

  // A layout effect, so the presented box is measured after the commit that
  // laid it out and before the first frame paints the tile's camera in it.
  useLayoutEffect(() => {
    if (wasPresented.current === presented) return;
    wasPresented.current = presented;
    const { instrument: inst, view: current, setView: write } = latest.current;
    if (!presented) {
      if (tileView.current !== undefined) write(tileView.current);
      tileView.current = undefined;
      return;
    }
    const size = measure(viewport.current);
    const fitted = size ? sizedInitialView(inst, size) : null;
    if (!fitted) return;
    tileView.current = current;
    write(fitted);
  }, [presented, latest, viewport]);

  return (size) => {
    if (view != null) return;
    const placed = sizedInitialView(instrument, size);
    if (placed) setView(placed);
  };
}
