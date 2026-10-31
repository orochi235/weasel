/** Edits to a gantt, as plain data in and out. Instants are milliseconds since the epoch, in UTC. */
import { formatGanttDate } from './dates';
import { dateFormatOf, excludedDays, ganttDurationBetween, scheduleGantt } from './schedule';
import type { GanttData, GanttEnd, GanttTask } from './types';

function taskAt(data: GanttData, section: number, task: number, what: string): GanttTask {
  const found = data.sections[section]?.tasks[task];
  if (found === undefined) throw new Error(`${what}: the gantt holds no task ${task} in section ${section}`);
  return found;
}

function withTask(data: GanttData, section: number, task: number, next: GanttTask): GanttData {
  return {
    ...data,
    sections: data.sections.map((s, i) => (i === section ? { ...s, tasks: s.tasks.map((t, j) => (j === task ? next : t)) } : s)),
  };
}

/** `t` rounded to the nearest whole `step`. */
export const snapGantt = (t: number, step: number): number => Math.round(t / step) * step;

/**
 * `data` with a task starting at `start`, written in the chart's `dateFormat`. A task that started after others, or
 * after the task before it, leaves that dependency: it starts on the date from then on. Its end is kept as written,
 * so a duration moves with it and a date stays put.
 */
export function moveGanttTask(data: GanttData, section: number, task: number, start: number): GanttData {
  const target = taskAt(data, section, task, 'moveGanttTask');
  const date = formatGanttDate(start, dateFormatOf(data));
  if (target.start.kind === 'date' && target.start.date === date) return data;
  return withTask(data, section, task, { ...target, start: { kind: 'date', date } });
}

/**
 * `data` with a task ending at `end`. A duration keeps its unit and takes the whole number of units nearest the span,
 * at least 1 (0 for a milestone), days and weeks counted past excluded days; a date takes the new date, not before the
 * start; an `until` end becomes a duration in days.
 */
export function setGanttEnd(data: GanttData, section: number, task: number, end: number): GanttData {
  const target = taskAt(data, section, task, 'setGanttEnd');
  const start = scheduleGantt(data).spans[section]![task]!.start;
  const old = target.end;
  let next: GanttEnd;
  if (old.kind === 'date') {
    next = { kind: 'date', date: formatGanttDate(Math.max(start, end), dateFormatOf(data)) };
    if (next.date === old.date) return data;
  } else {
    const unit = old.kind === 'duration' ? old.unit : 'd';
    const least = target.tags?.includes('milestone') ? 0 : 1;
    const amount = Math.max(least, ganttDurationBetween(start, end, unit, excludedDays(data)));
    if (old.kind === 'duration' && old.amount === amount) return data;
    next = { kind: 'duration', amount, unit };
  }
  return withTask(data, section, task, { ...target, end: next });
}

/** `data` with section `section` named `name`, trimmed. An empty name changes nothing. */
export function setGanttSectionName(data: GanttData, section: number, name: string): GanttData {
  const target = data.sections[section];
  if (target === undefined) throw new Error(`setGanttSectionName: the gantt holds no section ${section}`);
  const text = name.trim();
  if (text === '' || text === target.name) return data;
  return { ...data, sections: data.sections.map((s, i) => (i === section ? { ...s, name: text } : s)) };
}

/** `data` with a task named `name`, trimmed. An empty name changes nothing. */
export function setGanttTaskName(data: GanttData, section: number, task: number, name: string): GanttData {
  const target = taskAt(data, section, task, 'setGanttTaskName');
  const text = name.trim();
  if (text === '' || text === target.name) return data;
  return withTask(data, section, task, { ...target, name: text });
}
