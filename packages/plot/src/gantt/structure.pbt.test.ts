/**
 * A gantt's structural edits run in any sequence on any gantt: every dependency that named a task still names one
 * while a task holds that id, one naming an id no task holds any more is gone, no edit loses or duplicates a task it
 * did not mean to, and the chart still schedules to finite instants.
 */
import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { ganttData, runs, tally, timeoutFor } from '../pbt.fixture';
import { ganttTasks, scheduleGantt } from './schedule';
import {
  insertGanttSection, insertGanttTask, moveGanttSection, moveGanttTaskToSection, removeGanttSection, removeGanttTask,
  reorderGanttTask, setGanttTaskId,
} from './structure';
import type { GanttData } from './types';

const RUNS = 300;

/** Every id a dependency names. */
const refs = (d: GanttData): string[] => d.sections.flatMap((s) => s.tasks.flatMap((t) => [
  ...(t.start.kind === 'after' ? t.start.ids : []), ...(t.end.kind === 'until' ? t.end.ids : []),
]));
const ids = (d: GanttData): Set<string> => new Set(ganttTasks(d).flatMap((t) => (t.task.id === undefined ? [] : [t.task.id])));
const names = (d: GanttData): string[] => ganttTasks(d).map((t) => t.task.name).sort();

/** An edit's result, and for one taking tasks out, `data` with only those tasks gone, dependencies untouched. */
type Edit = (d: GanttData) => { next: GanttData; label: string; raw?: GanttData };
const edit = fc.tuple(fc.integer({ min: 0, max: 7 }), fc.nat(), fc.nat(), fc.nat(), fc.nat(), fc.constantFrom('t1', 't2', 'new', undefined))
  .map(([kind, a, b, c, e, id]): Edit => (d) => {
    const s = d.sections.length;
    const tasksIn = (k: number) => d.sections[k]?.tasks.length ?? 0;
    const sa = s === 0 ? 0 : a % s;
    const ta = tasksIn(sa) === 0 ? 0 : b % tasksIn(sa);
    switch (kind) {
      case 0: return { label: 'insertSection', next: insertGanttSection(d, a % (s + 1)) };
      case 1: return s === 0 ? { label: 'none', next: d }
        : { label: 'removeSection', next: removeGanttSection(d, sa), raw: { ...d, sections: d.sections.filter((_, k) => k !== sa) } };
      case 2: return s === 0 ? { label: 'none', next: d } : { label: 'moveSection', next: moveGanttSection(d, sa, b % s) };
      case 3: return s === 0 ? { label: 'none', next: d } : { label: 'insertTask', next: insertGanttTask(d, sa, b % (tasksIn(sa) + 1)) };
      case 4: return tasksIn(sa) === 0 ? { label: 'none', next: d } : {
        label: 'removeTask', next: removeGanttTask(d, sa, ta),
        raw: { ...d, sections: d.sections.map((x, k) => (k === sa ? { ...x, tasks: x.tasks.filter((_, j) => j !== ta) } : x)) },
      };
      case 5: return tasksIn(sa) === 0 ? { label: 'none', next: d } : { label: 'reorderTask', next: reorderGanttTask(d, sa, ta, c % tasksIn(sa)) };
      case 6: {
        if (tasksIn(sa) === 0) return { label: 'none', next: d };
        const to = c % s;
        const room = tasksIn(to) + (to === sa ? 0 : 1);
        return { label: 'moveTaskToSection', next: moveGanttTaskToSection(d, sa, ta, to, e % room) };
      }
      default: {
        if (tasksIn(sa) === 0) return { label: 'none', next: d };
        try {
          return { label: 'setTaskId', next: setGanttTaskId(d, sa, ta, id) };
        } catch {
          return { label: 'setTaskIdRefused', next: d };
        }
      }
    }
  });

describe('gantt structure, any sequence', () => {
  it('keeps every dependency naming a task while a task holds its id, and drops it once none does', () => {
    const seen = tally();
    fc.assert(fc.property(ganttData, fc.array(edit, { maxLength: 10 }), (data, edits) => {
      let d = data;
      for (const e of edits) {
        const before = d;
        const { next, label, raw } = e(d);
        seen.count(label);
        d = next;
        const held = ids(d);
        const heldBefore = ids(before);
        // A dependency naming an id some task held still names one, unless no task holds it now.
        for (const r of refs(d)) if (heldBefore.has(r)) expect(held.has(r)).toBe(true);
        const gone = [...heldBefore].filter((id) => !held.has(id));
        for (const id of gone) expect(refs(d)).not.toContain(id);
        // Each dependency id that resolved, and whose id a task still holds, is still there as often, where no task
        // holding dependencies was taken out.
        const removes = label === 'removeTask' || label === 'removeSection' || label === 'setTaskId';
        for (const id of held) {
          if (!heldBefore.has(id) || removes) continue;
          expect(refs(d).filter((r) => r === id).length).toBe(refs(before).filter((r) => r === id).length);
        }
        // Taking tasks out leaves every other task's dependency on an id a task still holds as it was.
        if (raw !== undefined) for (const id of held) expect(refs(d).filter((r) => r === id)).toEqual(refs(raw).filter((r) => r === id));
        if (label === 'reorderTask' || label === 'moveSection' || label === 'moveTaskToSection') expect(names(d)).toEqual(names(before));
        const { spans } = scheduleGantt(d);
        for (const span of spans.flat()) expect(Number.isFinite(span.start) && Number.isFinite(span.end)).toBe(true);
      }
    }), runs(RUNS));
    for (const label of ['removeSection', 'removeTask', 'moveTaskToSection', 'setTaskId']) seen.atLeast(label, 20);
  }, timeoutFor(RUNS, 10));
});
