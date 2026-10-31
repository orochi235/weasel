/**
 * Edits to a gantt's sections and tasks as collections, a task's every field, and the chart's settings, as plain data
 * in and out. A task taken out, or renamed, takes its id out of every `after` and `until` that named it.
 */
import { freshName, insertAt, moveAt, removeAt, updateAt, withOptional } from '../editing/lists';
import { ganttTasks } from './schedule';
import type { GanttData, GanttEnd, GanttSection, GanttStart, GanttTag, GanttTask } from './types';

const TAG_ORDER: readonly GanttTag[] = ['done', 'active', 'crit', 'milestone'];

/** A task of one day after the task before it, under a name no task holds. */
function freshTask(data: GanttData): GanttTask {
  const names = ganttTasks(data).map((t) => t.task.name);
  return { name: freshName('Task', names, names.length + 1), start: { kind: 'previous' }, end: { kind: 'duration', amount: 1, unit: 'd' } };
}

/** Every task's start and end with id `from` replaced by `to`, or (`to` absent) dropped; a dependency left naming
 *  nothing follows the task before it, or lasts a day. */
function renameRefs(data: GanttData, from: string, to: string | undefined): GanttData {
  const swap = (ids: readonly string[]): string[] => ids.flatMap((id) => (id !== from ? [id] : to === undefined ? [] : [to]));
  const start = (s: GanttStart): GanttStart => {
    if (s.kind !== 'after' || !s.ids.includes(from)) return s;
    const ids = swap(s.ids);
    return ids.length > 0 ? { kind: 'after', ids } : { kind: 'previous' };
  };
  const end = (e: GanttEnd): GanttEnd => {
    if (e.kind !== 'until' || !e.ids.includes(from)) return e;
    const ids = swap(e.ids);
    return ids.length > 0 ? { kind: 'until', ids } : { kind: 'duration', amount: 1, unit: 'd' };
  };
  return {
    ...data,
    sections: data.sections.map((s) => ({ ...s, tasks: s.tasks.map((t) => ({ ...t, start: start(t.start), end: end(t.end) })) })),
  };
}

/** `data` with the ids `tasks` hold taken out of every dependency. */
const dropRefs = (data: GanttData, tasks: readonly GanttTask[]): GanttData =>
  tasks.reduce((d, t) => (t.id === undefined ? d : renameRefs(d, t.id, undefined)), data);

/** `data` with `section` inserted before section `at`; absent, a section of one fresh task under a fresh name. */
export function insertGanttSection(data: GanttData, at: number, section?: GanttSection): GanttData {
  const next = section ?? {
    name: freshName('Section', data.sections.flatMap((s) => (s.name === undefined ? [] : [s.name])), data.sections.length + 1),
    tasks: [freshTask(data)],
  };
  return { ...data, sections: insertAt(data.sections, at, next, 'insertGanttSection') };
}

/** `data` without section `section` and its tasks. Throws on a section it does not hold. */
export function removeGanttSection(data: GanttData, section: number): GanttData {
  const sections = removeAt(data.sections, section, 'removeGanttSection');
  return dropRefs({ ...data, sections }, data.sections[section]!.tasks);
}

/** `data` with section `from` moved to index `to`, counted once it is taken out. */
export const moveGanttSection = (data: GanttData, from: number, to: number): GanttData =>
  (from === to ? data : { ...data, sections: moveAt(data.sections, from, to, 'moveGanttSection') });

/** `data` with section `section`'s tasks run through `change`. */
const withTasks = (data: GanttData, section: number, change: (tasks: readonly GanttTask[]) => GanttTask[], who: string): GanttData =>
  ({ ...data, sections: updateAt(data.sections, section, (s) => ({ ...s, tasks: change(s.tasks) }), who) });

/** `data` with `task` inserted before task `at` of section `section`; absent, a day-long task after the one before. */
export const insertGanttTask = (data: GanttData, section: number, at: number, task?: GanttTask): GanttData =>
  withTasks(data, section, (tasks) => insertAt(tasks, at, task ?? freshTask(data), 'insertGanttTask'), 'insertGanttTask');

/** `data` without task `task` of section `section`. Throws on a task it does not hold. */
export function removeGanttTask(data: GanttData, section: number, task: number): GanttData {
  const gone = data.sections[section]?.tasks[task];
  const next = withTasks(data, section, (tasks) => removeAt(tasks, task, 'removeGanttTask'), 'removeGanttTask');
  return dropRefs(next, gone === undefined ? [] : [gone]);
}

/** `data` with task `from` of section `section` moved to index `to` in it, counted once it is taken out. */
export const reorderGanttTask = (data: GanttData, section: number, from: number, to: number): GanttData =>
  (from === to ? data : withTasks(data, section, (tasks) => moveAt(tasks, from, to, 'reorderGanttTask'), 'reorderGanttTask'));

/** `data` with task `task` of section `from` moved into section `to` before its task `at` (absent, last). Its id and
 *  every dependency on it are kept. Throws on a task or section it does not hold. */
export function moveGanttTaskToSection(data: GanttData, from: number, task: number, to: number, at?: number): GanttData {
  const moving = data.sections[from]?.tasks[task];
  if (moving === undefined) throw new Error(`moveGanttTaskToSection: the gantt holds no task ${task} in section ${from}`);
  if (data.sections[to] === undefined) throw new Error(`moveGanttTaskToSection: the gantt holds no section ${to}`);
  if (from === to) return reorderGanttTask(data, from, task, at ?? data.sections[from]!.tasks.length - 1);
  const taken = withTasks(data, from, (tasks) => removeAt(tasks, task, 'moveGanttTaskToSection'), 'moveGanttTaskToSection');
  return withTasks(taken, to, (tasks) => insertAt(tasks, at ?? tasks.length, moving, 'moveGanttTaskToSection'), 'moveGanttTaskToSection');
}

/** `data` with one task changed by `change`; `data` itself when nothing changes. */
function withTask(data: GanttData, section: number, task: number, change: (t: GanttTask) => GanttTask, who: string): GanttData {
  const target = data.sections[section]?.tasks[task];
  if (target === undefined) throw new Error(`${who}: the gantt holds no task ${task} in section ${section}`);
  const next = change(target);
  return next === target ? data : withTasks(data, section, (tasks) => tasks.map((t, i) => (i === task ? next : t)), who);
}

/**
 * `data` with a task's id set to `id`, trimmed, every dependency naming the old id following it; an empty id drops
 * it and the dependencies on it. Throws on an id another task holds.
 */
export function setGanttTaskId(data: GanttData, section: number, task: number, id: string | undefined): GanttData {
  const next = id?.trim() || undefined;
  const target = data.sections[section]?.tasks[task];
  if (target === undefined) throw new Error(`setGanttTaskId: the gantt holds no task ${task} in section ${section}`);
  if (target.id === next) return data;
  if (next !== undefined && /\s/.test(next)) throw new Error(`setGanttTaskId: an id holds no spaces, and "${next}" does`);
  if (next !== undefined && ganttTasks(data).some((t) => t.task.id === next)) throw new Error(`setGanttTaskId: a task already has id "${next}"`);
  const renamed = withTask(data, section, task, (t) => withOptional(t, 'id', next), 'setGanttTaskId');
  return target.id === undefined ? renamed : renameRefs(renamed, target.id, next);
}

/** `data` with a task carrying `tags`, kept in one order and each once; none drops them. */
export const setGanttTaskTags = (data: GanttData, section: number, task: number, tags: readonly GanttTag[]): GanttData =>
  withTask(data, section, task, (t) => {
    const next = TAG_ORDER.filter((tag) => tags.includes(tag));
    const old = TAG_ORDER.filter((tag) => t.tags?.includes(tag));
    return next.join() === old.join() ? t : withOptional(t, 'tags', next.length > 0 ? next : undefined);
  }, 'setGanttTaskTags');

/** `data` with a task starting at `start`, as written. */
export const setGanttTaskStart = (data: GanttData, section: number, task: number, start: GanttStart): GanttData =>
  withTask(data, section, task, (t) => (JSON.stringify(t.start) === JSON.stringify(start) ? t : { ...t, start }), 'setGanttTaskStart');

/** `data` with a task ending at `end`, as written. */
export const setGanttTaskEnd = (data: GanttData, section: number, task: number, end: GanttEnd): GanttData =>
  withTask(data, section, task, (t) => (JSON.stringify(t.end) === JSON.stringify(end) ? t : { ...t, end }), 'setGanttTaskEnd');

/** `data` with one of its text settings set to `value`, trimmed; an empty one drops it, for the default. */
export function setGanttSetting(data: GanttData, key: 'dateFormat' | 'axisFormat' | 'todayMarker', value: string | undefined): GanttData {
  const text = value?.trim() || undefined;
  return data[key] === text ? data : withOptional(data, key, text);
}

/** `data` skipping `excludes` in durations counted in days, each trimmed; none drops them. */
export function setGanttExcludes(data: GanttData, excludes: readonly string[]): GanttData {
  const next = excludes.map((e) => e.trim()).filter((e) => e !== '');
  if (next.join() === (data.excludes ?? []).join()) return data;
  return withOptional(data, 'excludes', next.length > 0 ? next : undefined);
}
