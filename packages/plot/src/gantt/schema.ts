/** A gantt as its settings, a table of sections, and under each section a table of its tasks. */
import { listOf, textOf, titleField } from '../editing/schemaKit';
import type { PlotColumn, PlotField, PlotSchema, PlotScope } from '../editing/schemaTypes';
import { parseGanttDate } from './dates';
import { setGanttSectionName, setGanttTaskName } from './edit';
import { dateFormatOf } from './schedule';
import {
  insertGanttSection, insertGanttTask, moveGanttSection, moveGanttTaskToSection, removeGanttSection, removeGanttTask, reorderGanttTask,
  setGanttExcludes, setGanttSetting, setGanttTaskEnd, setGanttTaskId, setGanttTaskStart, setGanttTaskTags,
} from './structure';
import { formatGanttEnd, formatGanttStart, parseGanttEnd, parseGanttStart } from './text';
import type { GanttData, GanttTag, GanttTask } from './types';

const setting = (key: 'dateFormat' | 'axisFormat' | 'todayMarker', label: string, placeholder: string): PlotField<GanttData> => ({
  key, label, type: { kind: 'string', placeholder }, optional: true,
  get: (d) => d[key],
  set: (d, v) => (v === undefined || typeof v === 'string' ? setGanttSetting(d, key, v) : d),
});

const taskOf = (d: GanttData, scope: PlotScope, row: number): GanttTask | undefined => d.sections[scope[0]!]?.tasks[row];

/** Whether a date written in `d`'s format reads; any other start or end does. */
const reads = (d: GanttData, at: { kind: string; date?: string }): boolean =>
  at.kind !== 'date' || parseGanttDate(at.date!, dateFormatOf(d)) !== null;

const tagColumn = (tag: GanttTag, label: string): PlotColumn<GanttData> => ({
  key: tag, label, type: { kind: 'boolean' },
  get: (d, s, r) => taskOf(d, s, r)?.tags?.includes(tag) ?? false,
  set: (d, s, r, v) => {
    const tags = taskOf(d, s, r)?.tags ?? [];
    if (typeof v !== 'boolean') return d;
    return setGanttTaskTags(d, s[0]!, r, v ? [...tags, tag] : tags.filter((t) => t !== tag));
  },
});

/** Each section as a choice: its number and name, so two sections of one name stay apart. */
const sectionChoices = (d: GanttData): string[] => d.sections.map((s, i) => `${i + 1}. ${s.name ?? 'Untitled section'}`);

/** The section a task sits in; choosing another moves the task to its end. */
const sectionColumn = (d: GanttData): PlotColumn<GanttData> => ({
  key: 'section', label: 'Section', type: { kind: 'enum', options: sectionChoices(d) },
  get: (data, s) => sectionChoices(data)[s[0]!],
  set: (data, s, r, v) => {
    const to = typeof v === 'string' ? sectionChoices(data).indexOf(v) : -1;
    return to < 0 || to === s[0] ? data : moveGanttTaskToSection(data, s[0]!, r, to);
  },
});

const TASK_COLUMNS: readonly PlotColumn<GanttData>[] = [
  {
    key: 'name', label: 'Task', type: { kind: 'string' },
    get: (d, s, r) => taskOf(d, s, r)?.name,
    set: (d, s, r, v) => setGanttTaskName(d, s[0]!, r, textOf(v) ?? ''),
  },
  {
    key: 'id', label: 'Id', type: { kind: 'string' }, optional: true,
    get: (d, s, r) => taskOf(d, s, r)?.id,
    set: (d, s, r, v) => {
      const id = textOf(v)?.trim() || undefined;
      const taken = id !== undefined && (/\s/.test(id) || d.sections.some((sec) => sec.tasks.some((t) => t.id === id)));
      return (v !== undefined && typeof v !== 'string') || taken ? d : setGanttTaskId(d, s[0]!, r, id);
    },
  },
  {
    key: 'start', label: 'Start', type: { kind: 'string', placeholder: 'after the task before' },
    get: (d, s, r) => { const t = taskOf(d, s, r); return t && formatGanttStart(t.start); },
    set: (d, s, r, v) => {
      const start = parseGanttStart(textOf(v) ?? '');
      return reads(d, start) ? setGanttTaskStart(d, s[0]!, r, start) : d;
    },
  },
  {
    key: 'end', label: 'End', type: { kind: 'string', placeholder: '3d, a date, or until an id' },
    get: (d, s, r) => { const t = taskOf(d, s, r); return t && formatGanttEnd(t.end); },
    set: (d, s, r, v) => {
      const text = textOf(v)?.trim();
      if (!text) return d;
      const end = parseGanttEnd(text);
      return reads(d, end) ? setGanttTaskEnd(d, s[0]!, r, end) : d;
    },
  },
  tagColumn('done', 'Done'),
  tagColumn('active', 'Active'),
  tagColumn('crit', 'Critical'),
  tagColumn('milestone', 'Milestone'),
];

export const ganttSchema: PlotSchema<GanttData> = {
  fields: [
    titleField(),
    setting('dateFormat', 'Date format', 'YYYY-MM-DD'),
    setting('axisFormat', 'Axis format', '%Y-%m-%d'),
    {
      key: 'excludes', label: 'Excludes', type: { kind: 'string', placeholder: 'weekends, 2024-01-01' }, optional: true,
      get: (d) => (d.excludes && d.excludes.length > 0 ? d.excludes.join(', ') : undefined),
      set: (d, v) => (v === undefined || typeof v === 'string' ? setGanttExcludes(d, listOf(v ?? '')) : d),
    },
    setting('todayMarker', 'Today marker', 'off, or a style'),
  ],
  tables: [{
    key: 'sections', label: 'Sections', item: 'section',
    count: (d) => d.sections.length,
    columns: () => [{
      key: 'name', label: 'Section', type: { kind: 'string' },
      get: (d, _, r) => d.sections[r]?.name,
      set: (d, _, r, v) => setGanttSectionName(d, r, textOf(v) ?? ''),
    }],
    insert: (d, _, at) => insertGanttSection(d, at),
    remove: (d, _, r) => removeGanttSection(d, r),
    move: (d, _, from, to) => moveGanttSection(d, from, to),
    rowLabel: (d, _, r) => d.sections[r]?.name ?? 'Untitled section',
    children: [{
      key: 'tasks', label: 'Tasks', item: 'task',
      count: (d, s) => d.sections[s[0]!]?.tasks.length ?? 0,
      columns: (d) => [...TASK_COLUMNS, sectionColumn(d)],
      insert: (d, s, at) => insertGanttTask(d, s[0]!, at),
      remove: (d, s, r) => removeGanttTask(d, s[0]!, r),
      move: (d, s, from, to) => reorderGanttTask(d, s[0]!, from, to),
      rowLabel: (d, s, r) => taskOf(d, s, r)?.name ?? '',
    }],
  }],
};
