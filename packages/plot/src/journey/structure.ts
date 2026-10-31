/** Edits to a user journey's sections and steps as collections, and a step's actors, as plain data in and out. */
import { freshName, insertAt, moveAt, removeAt, updateAt } from '../editing/lists';
import type { JourneyData, JourneySection, JourneyTask } from './types';

const freshTask = (data: JourneyData): JourneyTask => {
  const names = data.sections.flatMap((s) => s.tasks.map((t) => t.name));
  return { name: freshName('Step', names, names.length + 1), score: 3, actors: [] };
};

/** `data` with `section` inserted before section `at`; absent, one fresh step under a fresh name. */
export function insertJourneySection(data: JourneyData, at: number, section?: JourneySection): JourneyData {
  const next = section ?? {
    name: freshName('Section', data.sections.flatMap((s) => (s.name === undefined ? [] : [s.name])), data.sections.length + 1),
    tasks: [freshTask(data)],
  };
  return { ...data, sections: insertAt(data.sections, at, next, 'insertJourneySection') };
}

/** `data` without section `section` and its steps. Throws on a section it does not hold. */
export const removeJourneySection = (data: JourneyData, section: number): JourneyData =>
  ({ ...data, sections: removeAt(data.sections, section, 'removeJourneySection') });

/** `data` with section `from` moved to index `to`, counted once it is taken out. */
export const moveJourneySection = (data: JourneyData, from: number, to: number): JourneyData =>
  (from === to ? data : { ...data, sections: moveAt(data.sections, from, to, 'moveJourneySection') });

const withTasks = (data: JourneyData, section: number, change: (t: readonly JourneyTask[]) => JourneyTask[], who: string): JourneyData =>
  ({ ...data, sections: updateAt(data.sections, section, (s) => ({ ...s, tasks: change(s.tasks) }), who) });

/** `data` with `task` inserted before step `at` of section `section`; absent, a fresh step scored 3 with no actors. */
export const insertJourneyTask = (data: JourneyData, section: number, at: number, task?: JourneyTask): JourneyData =>
  withTasks(data, section, (ts) => insertAt(ts, at, task ?? freshTask(data), 'insertJourneyTask'), 'insertJourneyTask');

/** `data` without step `task` of section `section`. Throws on a step it does not hold. */
export const removeJourneyTask = (data: JourneyData, section: number, task: number): JourneyData =>
  withTasks(data, section, (ts) => removeAt(ts, task, 'removeJourneyTask'), 'removeJourneyTask');

/** `data` with step `from` of section `section` moved to index `to` in it, counted once it is taken out. */
export const moveJourneyTask = (data: JourneyData, section: number, from: number, to: number): JourneyData =>
  (from === to ? data : withTasks(data, section, (ts) => moveAt(ts, from, to, 'moveJourneyTask'), 'moveJourneyTask'));

/** `data` with a step taken part in by `actors`, each trimmed and once. */
export function setJourneyActors(data: JourneyData, section: number, task: number, actors: readonly string[]): JourneyData {
  const next = [...new Set(actors.map((a) => a.trim()).filter((a) => a !== ''))];
  const target = data.sections[section]?.tasks[task];
  if (target === undefined) throw new Error(`setJourneyActors: section ${section} holds no step ${task}`);
  if (next.join('\n') === target.actors.join('\n')) return data;
  return withTasks(data, section, (ts) => ts.map((t, i) => (i === task ? { ...t, actors: next } : t)), 'setJourneyActors');
}
