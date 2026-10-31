/** A user journey as a table of sections and under each a table of its steps. Actors are written with commas, as
 *  Mermaid writes them, so no actor's name holds one. */
import { integerOf, listOf, textOf, titleField } from '../editing/schemaKit';
import type { PlotSchema, PlotScope } from '../editing/schemaTypes';
import { setJourneyScore, setJourneySectionName, setJourneyTaskName } from './edit';
import {
  insertJourneySection, insertJourneyTask, moveJourneySection, moveJourneyTask, removeJourneySection, removeJourneyTask, setJourneyActors,
} from './structure';
import type { JourneyData, JourneyTask } from './types';

const taskOf = (d: JourneyData, s: PlotScope, r: number): JourneyTask | undefined => d.sections[s[0]!]?.tasks[r];

export const journeySchema: PlotSchema<JourneyData> = {
  fields: [titleField()],
  tables: [{
    key: 'sections', label: 'Sections', item: 'section',
    count: (d) => d.sections.length,
    columns: () => [{
      key: 'name', label: 'Section', type: { kind: 'string' },
      get: (d, _, r) => d.sections[r]?.name,
      set: (d, _, r, v) => { const t = textOf(v)?.trim(); return t ? setJourneySectionName(d, r, t) : d; },
    }],
    insert: (d, _, at) => insertJourneySection(d, at),
    remove: (d, _, r) => removeJourneySection(d, r),
    move: (d, _, from, to) => moveJourneySection(d, from, to),
    rowLabel: (d, _, r) => d.sections[r]?.name ?? 'Untitled section',
    children: [{
      key: 'tasks', label: 'Steps', item: 'step',
      count: (d, s) => d.sections[s[0]!]?.tasks.length ?? 0,
      columns: () => [
        {
          key: 'name', label: 'Step', type: { kind: 'string' },
          get: (d, s, r) => taskOf(d, s, r)?.name,
          set: (d, s, r, v) => { const t = textOf(v)?.trim(); return t ? setJourneyTaskName(d, s[0]!, r, t) : d; },
        },
        {
          key: 'score', label: 'Score', type: { kind: 'number', min: 1, max: 5, step: 1 },
          get: (d, s, r) => taskOf(d, s, r)?.score,
          set: (d, s, r, v) => { const n = integerOf(v); return n !== undefined && n >= 1 && n <= 5 ? setJourneyScore(d, s[0]!, r, n) : d; },
        },
        {
          key: 'actors', label: 'Actors', type: { kind: 'string', placeholder: 'Me, Cat' },
          get: (d, s, r) => taskOf(d, s, r)?.actors.join(', '),
          set: (d, s, r, v) => (typeof v === 'string' ? setJourneyActors(d, s[0]!, r, listOf(v)) : d),
        },
      ],
      insert: (d, s, at) => insertJourneyTask(d, s[0]!, at),
      remove: (d, s, r) => removeJourneyTask(d, s[0]!, r),
      move: (d, s, from, to) => moveJourneyTask(d, s[0]!, from, to),
      rowLabel: (d, s, r) => taskOf(d, s, r)?.name ?? '',
    }],
  }],
};
