/** What each chart kind lets a drag edit: which marks carry a handle, and the spec a drag of one proposes. */
import type { PlotBox, PlotMarkTrait, PlotPoint } from '../marks/types';
import type { PlotMeasure } from '../measure';
import type { PlotData, PlotKind } from '../plotData';
import type { PlotTheme } from '../theme';
import { xyEditor } from '../xychart/editor';

/** A handle a press can take: where it stands in the plot's coordinates, and the cursor over it. */
export interface PlotHandle {
  at: PlotPoint;
  cursor: 'ns-resize' | 'ew-resize' | 'move';
}

/** One chart kind's edits. */
export interface PlotEditor<D extends PlotData> {
  /** The handle on a mark, or `null` for a mark a drag does not edit. */
  handle(data: D, mark: { trait: PlotMarkTrait; pose: PlotBox }): PlotHandle | null;
  /** A drag that took the handle on `mark`: the spec it proposes with the pointer at a point in the plot's coordinates.
   *  `null` when the mark has nothing to edit. */
  drag(data: D, mark: PlotMarkTrait, size: { width: number; height: number }, theme: PlotTheme, measure: PlotMeasure): ((at: PlotPoint) => D) | null;
}

const EDITORS: { readonly [K in PlotKind]?: PlotEditor<Extract<PlotData, { kind: K }>> } = {
  xychart: xyEditor,
};

/** The edits `data`'s kind allows, or `null` for a kind with none. */
export const plotEditorOf = (data: PlotData): PlotEditor<PlotData> | null =>
  (EDITORS[data.kind] as PlotEditor<PlotData> | undefined) ?? null;
