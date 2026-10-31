/** Edits to a user journey, as plain data in and out. */
import type { JourneyLayout } from './compile';
import type { JourneyData, JourneyTask } from './types';

/** `data` with step `task` of section `section` changed. Throws on a step the journey does not hold. */
function withTask(data: JourneyData, section: number, task: number, change: Partial<JourneyTask>, who: string): JourneyData {
  const target = data.sections[section]?.tasks[task];
  if (target === undefined) throw new Error(`${who}: section ${section} holds no step ${task}`);
  if (Object.entries(change).every(([k, v]) => target[k as keyof JourneyTask] === v)) return data;
  return {
    ...data,
    sections: data.sections.map((s, i) => (i === section ? { ...s, tasks: s.tasks.map((t, j) => (j === task ? { ...t, ...change } : t)) } : s)),
  };
}

/** `data` with a step's score set to `score`. Throws on a step the journey does not hold. */
export const setJourneyScore = (data: JourneyData, section: number, task: number, score: number): JourneyData =>
  withTask(data, section, task, { score }, 'setJourneyScore');

/** `data` with a step named `name`. Throws on a step the journey does not hold. */
export const setJourneyTaskName = (data: JourneyData, section: number, task: number, name: string): JourneyData =>
  withTask(data, section, task, { name }, 'setJourneyTaskName');

/** `data` with section `section` named `name`. Throws on a section the journey does not hold. */
export function setJourneySectionName(data: JourneyData, section: number, name: string): JourneyData {
  const target = data.sections[section];
  if (target === undefined) throw new Error(`setJourneySectionName: the journey holds no section ${section}`);
  if (target.name === name) return data;
  return { ...data, sections: data.sections.map((s, i) => (i === section ? { ...s, name } : s)) };
}

/** The score under `at`: a whole number from 1 to 5. */
export const journeyScoreAt = (layout: JourneyLayout, at: { x: number; y: number }): number =>
  Math.min(5, Math.max(1, Math.round(layout.score.invert(at.y))));
