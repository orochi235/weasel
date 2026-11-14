import { createContext, useContext, useMemo, type ReactElement, type ReactNode } from 'react';
import type { RunAlign, TrackShape } from '@weasel-js/geom';
import type { MenuSide } from '@weasel-js/menu';

/** Which way a row of controls runs. A vertical one turns its structure a quarter turn and keeps what it holds upright. */
export type Orientation = 'horizontal' | 'vertical';

/** The run a control sits in: the row, column, or curve its parent lays it along. */
export interface Run {
  /** Which way a straight run goes. */
  orientation: Orientation;
  /** The track the run lies along, from the nearest `Along`; undefined on a straight run. */
  shape: TrackShape | undefined;
  /** Where a run shorter than its track sits; undefined where nothing says, so each control keeps its own default. */
  align: RunAlign | undefined;
  /** The side a popover or menu opens on from the point of the run this control sits at; undefined where it opens
   *  as it would anywhere else. */
  side: MenuSide | undefined;
}

/** A straight horizontal run: what a control sees outside every scope. */
export const STRAIGHT_RUN: Run = { orientation: 'horizontal', shape: undefined, align: undefined, side: undefined };

const RunContext = createContext<Run>(STRAIGHT_RUN);

/** The run this control sits in. */
export function useRun(): Run {
  return useContext(RunContext);
}

/** Props for {@link RunScope}. */
export interface RunScopeProps {
  orientation?: Orientation;
  shape?: TrackShape;
  align?: RunAlign;
  side?: MenuSide;
  /** Start from {@link STRAIGHT_RUN} rather than the enclosing run, for a surface that lays out its own contents: a
   *  popover, or the items a curved control places one by one. */
  fresh?: boolean;
  children: ReactNode;
}

/**
 * Tells the controls inside it about the run they sit in. Each field given replaces the enclosing run's, and each left
 * out keeps it. A straight bar sets `orientation`, `Along` sets `shape` and `align`, and a curved bar sets `side` on
 * each of its items.
 */
export function RunScope({ orientation, shape, align, side, fresh, children }: RunScopeProps): ReactElement {
  const outer = useRun();
  const base = fresh ? STRAIGHT_RUN : outer;
  const value = useMemo<Run>(() => ({
    orientation: orientation ?? base.orientation,
    shape: shape ?? base.shape,
    align: align ?? base.align,
    side: side ?? base.side,
  }), [base, orientation, shape, align, side]);
  return <RunContext.Provider value={value}>{children}</RunContext.Provider>;
}
