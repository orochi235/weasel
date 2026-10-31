import { describe, expect, it } from 'vitest';
import { compilePlot } from '../plotData';
import { PLOT_THEME } from '../theme';
import {
  insertJourneySection, insertJourneyTask, moveJourneySection, moveJourneyTask, removeJourneySection, removeJourneyTask, setJourneyActors,
} from './structure';
import type { JourneyData } from './types';

const measure = (text: string) => ({ width: text.length * 7, height: 14 });
const compiles = (d: JourneyData) => expect(compilePlot(d, { width: 600, height: 400 }, PLOT_THEME, measure).length).toBeGreaterThan(0);

describe('journey structure', () => {
  it('builds a journey from nothing: sections of steps', () => {
    let d = insertJourneySection({ kind: 'journey', sections: [] }, 0);
    d = insertJourneyTask(d, 0, 1);
    d = insertJourneySection(d, 1);
    expect(d.sections).toEqual([
      { name: 'Section 1', tasks: [{ name: 'Step 1', score: 3, actors: [] }, { name: 'Step 2', score: 3, actors: [] }] },
      { name: 'Section 2', tasks: [{ name: 'Step 3', score: 3, actors: [] }] },
    ]);
    compiles(d);
  });

  it('moves and removes sections and steps, and sets actors trimmed and once', () => {
    const d: JourneyData = { kind: 'journey', sections: [
      { name: 'A', tasks: [{ name: 'a', score: 1, actors: [] }, { name: 'b', score: 5, actors: ['Me'] }] },
      { name: 'B', tasks: [] },
    ] };
    expect(moveJourneySection(d, 0, 1).sections.map((s) => s.name)).toEqual(['B', 'A']);
    expect(removeJourneySection(d, 1).sections.map((s) => s.name)).toEqual(['A']);
    expect(moveJourneyTask(d, 0, 1, 0).sections[0]!.tasks.map((t) => t.name)).toEqual(['b', 'a']);
    expect(removeJourneyTask(d, 0, 0).sections[0]!.tasks.map((t) => t.name)).toEqual(['b']);
    expect(setJourneyActors(d, 0, 0, [' Me ', 'Cat', 'Me', '']).sections[0]!.tasks[0]!.actors).toEqual(['Me', 'Cat']);
    expect(setJourneyActors(d, 0, 1, ['Me'])).toBe(d);
    expect(() => setJourneyActors(d, 1, 0, [])).toThrow(/no step 0/);
    compiles(d);
  });
});
