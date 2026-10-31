/** What each chart kind lets a drag or a text edit change: which marks carry a handle, and the spec an edit proposes. */
import { ganttEditor } from '../gantt/editor';
import { gitgraphEditor } from '../gitgraph/editor';
import { journeyEditor } from '../journey/editor';
import type { PlotBox, PlotDatum, PlotMarkTrait, PlotPoint } from '../marks/types';
import type { PlotMeasure } from '../measure';
import { packetEditor } from '../packet/editor';
import { pieEditor } from '../pie/editor';
import type { PlotData, PlotKind } from '../plotData';
import { quadrantEditor } from '../quadrant/editor';
import { radarEditor } from '../radar/editor';
import { sankeyEditor } from '../sankey/editor';
import type { PlotTheme } from '../theme';
import { timelineEditor } from '../timeline/editor';
import { xyEditor } from '../xychart/editor';

/** A handle a press can take: where it stands in the plot's coordinates, and the cursor over it. */
export interface PlotHandle {
  at: PlotPoint;
  cursor: 'ns-resize' | 'ew-resize' | 'move';
  /** Which of a mark's handles this is, handed back to {@link PlotEditor.drag}; for a mark with more than one. */
  part?: string;
  /** Takes a press anywhere in this box, in the plot's coordinates, rather than near `at`. */
  box?: PlotBox;
}

/** One chart kind's edits. */
export interface PlotEditor<D extends PlotData> {
  /** The handles on a mark, or `null` for a mark a drag does not edit. */
  handle(data: D, mark: { trait: PlotMarkTrait; pose: PlotBox }): PlotHandle | readonly PlotHandle[] | null;
  /** A drag that took the handle `part` on `mark`: the spec it proposes with the pointer at a point in the plot's
   *  coordinates. `null` when the mark has nothing to edit. */
  drag(
    data: D, mark: PlotMarkTrait, size: { width: number; height: number }, theme: PlotTheme, measure: PlotMeasure, part?: string,
  ): ((at: PlotPoint) => D) | null;
  /** The spec with the text a text mark of `datum` stands for set to `text`; `data` itself when that changes
   *  nothing or `text` does not read (a value that is not a number). Absent for a kind with no text edits. */
  text?(data: D, datum: PlotDatum, text: string): D;
}

const EDITORS: { readonly [K in PlotKind]?: PlotEditor<Extract<PlotData, { kind: K }>> } = {
  xychart: xyEditor,
  gantt: ganttEditor,
  timeline: timelineEditor,
  pie: pieEditor,
  quadrant: quadrantEditor,
  journey: journeyEditor,
  gitgraph: gitgraphEditor,
  sankey: sankeyEditor,
  packet: packetEditor,
  radar: radarEditor,
};

/** The edits `data`'s kind allows, or `null` for a kind with none. */
export const plotEditorOf = (data: PlotData): PlotEditor<PlotData> | null =>
  (EDITORS[data.kind] as PlotEditor<PlotData> | undefined) ?? null;

/** A handle list as an array, whatever {@link PlotEditor.handle} returned. */
export const handlesOf = (h: PlotHandle | readonly PlotHandle[] | null): readonly PlotHandle[] =>
  h === null ? [] : Array.isArray(h) ? h : [h as PlotHandle];
