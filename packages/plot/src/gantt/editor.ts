/** Dragging a gantt's tasks to move them or change how long they run, and editing its text in place. */
import { withTitle } from '../chartTitle';
import type { PlotEditor } from '../editing/editors';
import type { PlotDatum } from '../marks/types';
import { compileGantt } from './compile';
import { moveGanttTask, setGanttEnd, setGanttSectionName, setGanttTaskName, snapGantt } from './edit';
import type { GanttData } from './types';

/** The task a mark stands for, or `null` for a mark that stands for none the chart holds. */
function taskOf(data: GanttData, datum: PlotDatum | undefined): { section: number; task: number } | null {
  const { section, task } = datum ?? {};
  if (typeof section !== 'number' || typeof task !== 'number') return null;
  return data.sections[section]?.tasks[task] !== undefined ? { section, task } : null;
}

function setText(data: GanttData, datum: PlotDatum, text: string): GanttData {
  if (datum.edit === 'title') return withTitle(data, text);
  if (datum.edit === 'section' && typeof datum.section === 'number' && data.sections[datum.section] !== undefined) {
    return setGanttSectionName(data, datum.section, text);
  }
  const at = datum.edit === 'task' ? taskOf(data, datum) : null;
  return at === null ? data : setGanttTaskName(data, at.section, at.task, text);
}

/**
 * A task's bar takes a press anywhere in it, and a drag moves its start; a handle on its right edge changes its end.
 * A milestone's diamond only moves.
 */
export const ganttEditor: PlotEditor<GanttData> = {
  handle(data, { trait, pose }) {
    if ((trait.kind !== 'span' && trait.kind !== 'area') || taskOf(data, trait.datum) === null) return null;
    const cy = pose.y + pose.height / 2;
    if (trait.kind === 'area') return { at: { x: pose.x + pose.width / 2, y: cy }, cursor: 'move', part: 'move', box: pose };
    return [
      { at: { x: pose.x, y: cy }, cursor: 'move', part: 'move', box: pose },
      { at: { x: pose.x + pose.width, y: cy }, cursor: 'ew-resize', part: 'end' },
    ];
  },
  drag(data, trait, size, theme, measure, part) {
    const at = taskOf(data, trait.datum);
    if (at === null || (part !== 'move' && part !== 'end')) return null;
    const { layout } = compileGantt(data, size, theme, measure);
    const instant = (x: number) => snapGantt(layout.time.invert(x), layout.snap);
    if (part === 'move') return (p) => moveGanttTask(data, at.section, at.task, instant(p.x));
    // A duration rounds to its own unit, which may be finer than the snap.
    const snaps = data.sections[at.section]!.tasks[at.task]!.end.kind === 'date';
    return (p) => setGanttEnd(data, at.section, at.task, snaps ? instant(p.x) : layout.time.invert(p.x));
  },
  text: setText,
};
