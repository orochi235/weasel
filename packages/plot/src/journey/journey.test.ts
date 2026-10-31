import { describe, expect, it } from 'vitest';
import type { PlotHandle } from '../editing/editors';
import { PLOT_THEME, seriesColor } from '../theme';
import { compileJourney, journeyActors } from './compile';
import { journeyScoreAt, setJourneyScore, setJourneySectionName, setJourneyTaskName } from './edit';
import { journeyEditor } from './editor';
import type { JourneyData } from './types';

const measure = (text: string) => ({ width: text.length * 7, height: 14 });
const SIZE = { width: 800, height: 450 };

const DAY: JourneyData = {
  kind: 'journey',
  title: 'My working day',
  sections: [
    { name: 'Go to work', tasks: [{ name: 'Make tea', score: 5, actors: ['Me'] }, { name: 'Go upstairs', score: 3, actors: ['Me'] }] },
    { name: 'Go home', tasks: [{ name: 'Sit down', score: 1, actors: ['Me', 'Cat'] }] },
  ],
};

const byKey = (data: JourneyData) => {
  const { marks, layout } = compileJourney(data, SIZE, PLOT_THEME, measure);
  return { layout, marks, get: (key: string) => marks.find((m) => m.key === key) };
};

describe('compileJourney', () => {
  it('stands each step at its score, left to right, in its section\'s color', () => {
    const { layout, get } = byKey(DAY);
    const tea = get('task:0:0')!;
    expect(tea.data.plotMark).toEqual({ kind: 'point', datum: { section: 0, task: 0 } });
    expect(tea.pose.width).toBe(16);
    expect(tea.pose.y + 8).toBeCloseTo(layout.score.map(5));
    expect(tea.pose.x + 8).toBeCloseTo(layout.steps.position('0'));
    const sit = get('task:1:0')!;
    expect(sit.pose.x + 8).toBeCloseTo(layout.steps.position('2'));
    expect(sit.data.fill?.paint.color).toBe(seriesColor(PLOT_THEME, 1));
  });

  it('drops a rule from each step to the baseline and writes its name under it', () => {
    const { layout, get } = byKey(DAY);
    const rule = get('task:rule:0:1')!;
    expect(rule.pose.y + rule.pose.height).toBeCloseTo(layout.plot.y + layout.plot.height);
    const name = get('task:label:0:1')!;
    expect(name.data.text).toBe('Go upstairs');
    expect(name.pose.y).toBeGreaterThan(layout.plot.y + layout.plot.height);
    expect(name.data.plotMark.datum).toEqual({ edit: 'task', section: 0, task: 1 });
  });

  it('heads each section across its steps', () => {
    const { layout, get } = byKey(DAY);
    const head = get('section:0')!;
    expect(head.pose.x).toBeCloseTo(layout.steps.start('0'));
    expect(head.pose.x + head.pose.width).toBeCloseTo(layout.steps.start('1') + layout.steps.bandwidth);
    expect(head.pose.y + head.pose.height).toBeLessThan(layout.plot.y);
    expect(get('section:label:1')!.data.text).toBe('Go home');
    expect(get('section:label:1')!.data.plotMark.datum).toEqual({ edit: 'section', section: 1 });
  });

  it('marks a score axis from 1 to 5 up the left', () => {
    const { get } = byKey(DAY);
    expect([0, 1, 2, 3, 4].map((i) => get(`axis:score:label:${i}`)!.data.text)).toEqual(['1', '2', '3', '4', '5']);
  });

  it('lists the actors in a legend and dots each step with its actors\' colors', () => {
    expect(journeyActors(DAY)).toEqual(['Me', 'Cat']);
    const { layout, get } = byKey(DAY);
    expect(get('legend:label:1')!.data.text).toBe('Cat');
    expect(get('legend:label:1')!.pose.x).toBeGreaterThan(layout.plot.x + layout.plot.width);
    const cat = get('task:actor:1:0:1')!;
    expect(cat.data.fill?.paint.color).toBe(get('legend:actor:1')!.data.fill?.paint.color);
    expect(cat.data.fill?.paint.color).toBe(PLOT_THEME.series[1]);
    expect(cat.data.plotMark.datum).toEqual({ section: 1, task: 0, actor: 'Cat' });
  });

  it('draws an empty journey and a tiny box without throwing', () => {
    expect(() => compileJourney({ kind: 'journey', sections: [] }, SIZE, PLOT_THEME, measure)).not.toThrow();
    expect(() => compileJourney(DAY, { width: 3, height: 3 }, PLOT_THEME, measure)).not.toThrow();
  });
});

describe('journey edits', () => {
  it('sets a step\'s score and name, and a section\'s name', () => {
    const next = setJourneyScore(DAY, 1, 0, 4);
    expect(next.sections[1]!.tasks[0]!.score).toBe(4);
    expect(next.sections[0]).toBe(DAY.sections[0]);
    expect(setJourneyScore(DAY, 0, 0, 5)).toBe(DAY);
    expect(setJourneyTaskName(DAY, 0, 1, 'Climb').sections[0]!.tasks[1]!.name).toBe('Climb');
    expect(setJourneySectionName(DAY, 1, 'Leave').sections[1]!.name).toBe('Leave');
    expect(() => setJourneyScore(DAY, 0, 9, 1)).toThrow(/holds no step 9/);
  });

  it('reads the score under the pointer as a whole number from 1 to 5', () => {
    const { layout } = byKey(DAY);
    expect(journeyScoreAt(layout, { x: 0, y: layout.score.map(3.4) })).toBe(3);
    expect(journeyScoreAt(layout, { x: 0, y: layout.score.map(3.6) })).toBe(4);
    expect(journeyScoreAt(layout, { x: 0, y: -1000 })).toBe(5);
    expect(journeyScoreAt(layout, { x: 0, y: 5000 })).toBe(1);
  });

  it('the editor puts a handle on each step\'s dot, not its actors\', and a drag sets its score', () => {
    const { layout, get } = byKey(DAY);
    const step = get('task:0:1')!;
    const handle = journeyEditor.handle(DAY, { trait: step.data.plotMark, pose: step.pose }) as PlotHandle;
    expect(handle.cursor).toBe('ns-resize');
    expect(handle.at.y).toBeCloseTo(layout.score.map(3));
    const actor = get('task:actor:1:0:0')!;
    expect(journeyEditor.handle(DAY, { trait: actor.data.plotMark, pose: actor.pose })).toBeNull();
    const drag = journeyEditor.drag(DAY, step.data.plotMark, SIZE, PLOT_THEME, measure)!;
    expect(drag({ x: handle.at.x, y: layout.score.map(1.8) }).sections[0]!.tasks[1]!.score).toBe(2);
  });

  it('the editor sets text typed in place', () => {
    const text = journeyEditor.text!;
    expect(text(DAY, { edit: 'title' }, 'Day').title).toBe('Day');
    expect(text(DAY, { edit: 'section', section: 0 }, ' Commute ').sections[0]!.name).toBe('Commute');
    expect(text(DAY, { edit: 'task', section: 1, task: 0 }, 'Rest').sections[1]!.tasks[0]!.name).toBe('Rest');
    expect(text(DAY, { edit: 'task', section: 1, task: 0 }, '')).toBe(DAY);
    expect(text(DAY, { edit: 'section', section: 5 }, 'x')).toBe(DAY);
  });
});
