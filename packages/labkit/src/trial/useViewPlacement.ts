import { useLatest } from '@weasel-js/core';
import { type RefObject, useLayoutEffect, useRef } from 'react';
import { layoutSize } from '../canvas/hostBox';
import type { ViewportSize } from '../canvas/worldSpec';
import type { Instrument } from '../instrument/types';
import { as2DView, as3DView } from '../state/view';
import { homeView, opensBySize } from './homeView';

/** The view `instrument` opens on in a viewport of `size`, or `null` when where
 *  it opens does not depend on the size. */
function sizedInitialView(instrument: Instrument, size: ViewportSize): unknown {
  return opensBySize(instrument) ? homeView(instrument, size) : null;
}

const near = (a: number, b: number): boolean => Math.abs(a - b) < 1e-6;

/** Whether `view` is still where `placed` put it — either view shape. */
function sitsAt(view: unknown, placed: unknown): boolean {
  const a2 = as2DView(view);
  const b2 = as2DView(placed);
  if (a2 && b2) {
    return near(a2.zoom, b2.zoom) && near(a2.pan.x, b2.pan.x) && near(a2.pan.y, b2.pan.y);
  }
  const a3 = as3DView(view);
  const b3 = as3DView(placed);
  if (a3 && b3) {
    return (
      near(a3.yaw, b3.yaw) &&
      near(a3.pitch, b3.pitch) &&
      near(a3.distance, b3.distance) &&
      near(a3.target.x, b3.target.x) &&
      near(a3.target.y, b3.target.y) &&
      near(a3.target.z, b3.target.z)
    );
  }
  return false;
}

interface ViewPlacementOptions {
  instrument: Instrument;
  view: unknown;
  setView: (view: unknown) => void;
  /** Whether the trial is the one its lab is presenting. */
  presented: boolean;
  /** The element the trial's camera fills. */
  viewport: RefObject<HTMLElement | null>;
  /** How the camera sizes its element, in the px its `onResize` reports.
   *  Omitted, its layout size. */
  measure?: (el: HTMLElement | null) => ViewportSize | null;
}

/** What {@link useViewPlacement} hands back. */
export interface ViewPlacement {
  /** The handler for each measurement of the camera's element. */
  place: (size: ViewportSize) => void;
  /** Where the camera opened, at the size last measured: what the `home`
   *  gesture returns it to. */
  home: () => unknown;
}

/**
 * Places a trial's view where its instrument's `initialView` needs the
 * viewport's size: on the first measurement while the view is `null` — the
 * unplaced marker, which reset writes too — and again on entering
 * presentation, for the presented box. Leaving gives the tile back the view it
 * had. A view still sitting where the last measurement would have placed it is
 * placed again when the viewport changes size; one that has been moved keeps
 * where it is.
 */
export function useViewPlacement({
  instrument,
  view,
  setView,
  presented,
  viewport,
  measure = layoutSize,
}: ViewPlacementOptions): ViewPlacement {
  const latest = useLatest({ instrument, view, setView, measure });
  // The tile's view while presented; `undefined` when nothing was refitted.
  const tileView = useRef<unknown>(undefined);
  const wasPresented = useRef(presented);

  // A layout effect, so the presented box is measured after the commit that
  // laid it out and before the first frame paints the tile's camera in it.
  useLayoutEffect(() => {
    if (wasPresented.current === presented) return;
    wasPresented.current = presented;
    const { instrument: inst, view: current, setView: write, measure: sizeOf } = latest.current;
    if (!presented) {
      if (tileView.current !== undefined) write(tileView.current);
      tileView.current = undefined;
      return;
    }
    const size = sizeOf(viewport.current);
    const fitted = size ? sizedInitialView(inst, size) : null;
    if (!fitted) return;
    tileView.current = current;
    write(fitted);
  }, [presented, latest, viewport]);

  const measured = useRef<ViewportSize | null>(null);

  return {
    place: (size) => {
      const last = measured.current;
      measured.current = size;
      if (view != null) {
        if (!last || (last.width === size.width && last.height === size.height)) return;
        if (!sitsAt(view, sizedInitialView(instrument, last))) return;
      }
      const placed = sizedInitialView(instrument, size);
      if (placed) setView(placed);
    },
    home: () => homeView(instrument, measured.current ?? measure(viewport.current)),
  };
}
