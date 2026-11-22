import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { GanttData } from '@weasel-js/plot';
import { describe, expect, it } from 'vitest';
import type { PlotPage } from '../../document';
import { DIAGRAM_MERMAID } from '../format';
import { readMermaidGantt } from './read';
import { writeMermaidGantt } from './write';

const FIXTURES = ['project.mmd', 'release.mmd'];
const fixture = (name: string) => readFileSync(join(__dirname, '..', '..', '__fixtures__', 'mermaid', 'gantt', name), 'utf8');
const plotOf = (text: string) => readMermaidGantt(text).document.pages[0] as PlotPage;
const ganttOf = (text: string) => plotOf(text).data as GanttData;
const pageOf = (data: GanttData): PlotPage => ({ kind: 'plot', id: 'p', width: 10, height: 10, data });

describe('reading a Mermaid gantt', () => {
  it('reads its settings, sections and tasks onto one plot page, starts and ends as written', () => {
    const { document, warnings } = readMermaidGantt(fixture('project.mmd'));
    const page = document.pages[0] as PlotPage;
    expect(page).toMatchObject({ kind: 'plot', id: 'page-1', name: 'A Gantt Diagram', width: 1000, height: 500 });
    const data = page.data as GanttData;
    expect(data).toMatchObject({
      kind: 'gantt', title: 'A Gantt Diagram', dateFormat: 'YYYY-MM-DD', axisFormat: '%b %e', excludes: ['weekends', '2014-01-10'],
      todayMarker: 'stroke-width:5px,stroke:#0f0,opacity:0.5',
    });
    expect(data.sections.map((s) => [s.name, s.tasks.length])).toEqual([['A section', 4], ['Critical tasks', 7], ['Documentation', 3]]);
    const [critical, docs] = [data.sections[1]!.tasks, data.sections[2]!.tasks];
    expect(data.sections[0]!.tasks[0]).toEqual({
      name: 'Completed task', id: 'des1', tags: ['done'], start: { kind: 'date', date: '2014-01-06' }, end: { kind: 'date', date: '2014-01-08' },
    });
    expect(data.sections[0]!.tasks[2]).toEqual({
      name: 'Future task', id: 'des3', start: { kind: 'after', ids: ['des2'] }, end: { kind: 'duration', amount: 5, unit: 'd' },
    });
    expect(critical[0]).toMatchObject({ tags: ['crit', 'done'], end: { kind: 'duration', amount: 24, unit: 'h' } });
    expect(critical[2]).toEqual({ name: 'Create tests for parser', tags: ['crit', 'active'], start: { kind: 'previous' }, end: { kind: 'duration', amount: 3, unit: 'd' } });
    expect(critical[5]).toEqual({ name: 'Add to mermaid', start: { kind: 'previous' }, end: { kind: 'until', ids: ['isadded'] } });
    expect(critical[6]).toMatchObject({ id: 'isadded', tags: ['milestone'], end: { kind: 'duration', amount: 0, unit: 'd' } });
    expect(docs[1]).toEqual({ name: 'Add gantt diagram to demo page', start: { kind: 'after', ids: ['a1'] }, end: { kind: 'duration', amount: 20, unit: 'h' } });
    expect(warnings).toEqual(['The front matter title was dropped; the title statement names the chart.']);
  });

  it('warns that an accessible title was dropped where a title statement names the chart', () => {
    const { document, warnings } = readMermaidGantt('gantt\n  title Plan\n  accTitle: Roadmap\n  A :a, 2024-01-01, 1d');
    expect(document.pages[0]!.name).toBe('Plan');
    expect(warnings).toEqual(['Mermaid accessible titles were dropped; the page is named by the title.']);
  });

  it('warns of the statements and markers it drops', () => {
    const { warnings } = readMermaidGantt(fixture('release.mmd'));
    expect(warnings).toEqual(['Mermaid gantt statements were dropped: tickInterval, click.']);
    const more = readMermaidGantt('gantt\n  inclusiveEndDates\n  topAxis\n  weekday monday\n  displayMode compact\n  Deadline : vert, v1, 2024-01-05, 0d\n  weekend party : 1d');
    expect(more.warnings).toEqual([
      'Mermaid gantt statements were dropped: inclusiveEndDates, topAxis, weekday, displayMode.',
      'Mermaid gantt vertical markers were dropped.',
    ]);
    expect((more.document.pages[0] as PlotPage).data).toMatchObject({ sections: [{ tasks: [{ name: 'weekend party' }] }] });
  });

  it('takes the front matter title where there is no title statement', () => {
    expect(ganttOf('---\ntitle: Up top\n---\ngantt\n  T : 1d').title).toBe('Up top');
  });

  it('throws, naming the line, on what it cannot read', () => {
    expect(() => readMermaidGantt('gantt\n\n  no colon here')).toThrow('Mermaid, line 3: "no colon here" is not a gantt statement');
    expect(() => readMermaidGantt('gantt\n  T : a, b, c, d')).toThrow(/line 2: a task takes an id, a start and an end/);
    expect(() => readMermaidGantt('gantt\n  T : crit')).toThrow(/line 2: a task needs an end/);
    expect(() => readMermaidGantt('gantt LR\n  T : 1d')).toThrow(/line 1: "gantt LR" is not a gantt header/);
  });
});

describe('writing a Mermaid gantt', () => {
  it('round-trips each fixture', () => {
    for (const name of FIXTURES) {
      const page = plotOf(fixture(name));
      const { text, warnings } = writeMermaidGantt(page);
      expect(warnings).toEqual([]);
      expect(plotOf(text).data).toEqual(page.data);
    }
  });

  it('writes settings, then each task\'s tags, id, start and end', () => {
    expect(writeMermaidGantt(plotOf(fixture('release.mmd'))).text).toBe([
      'gantt',
      '  dateFormat HH:mm',
      '  axisFormat %H:%M',
      '  todayMarker off',
      '  Initial milestone :milestone, m1, 17:49, 2m',
      '  Task A :10m',
      '  Task B :5m',
      '  Final milestone :milestone, m2, 18:08, 4m',
      '',
    ].join('\n'));
    const text = writeMermaidGantt(plotOf(fixture('project.mmd'))).text;
    expect(text).toContain('\n  section Critical tasks\n    Completed task in the critical line :crit, done, 2014-01-06, 24h\n');
    expect(text).toContain('\n    Add to mermaid :until isadded\n');
  });

  it('names a task after the one before it by that task\'s id, and warns on what Mermaid cannot hold', () => {
    const data: GanttData = {
      kind: 'gantt',
      sections: [
        { name: 'A', tasks: [{ name: 'One', id: 'one', start: { kind: 'date', date: '2026-01-01' }, end: { kind: 'duration', amount: 1.5, unit: 'w' } }] },
        { tasks: [{ name: 'Two: the\nsequel', id: 'two', start: { kind: 'previous' }, end: { kind: 'date', date: '2026-02-01' } }] },
      ],
    };
    const { text, warnings } = writeMermaidGantt(pageOf(data));
    expect(text).toBe('gantt\n  section A\n    One :one, 2026-01-01, 1.5w\n    Two#58; the sequel :two, after one, 2026-02-01\n');
    expect(ganttOf(text).sections[0]!.tasks[1]!.name).toBe('Two: the sequel');
    expect(warnings).toEqual([
      'Mermaid holds no unnamed section after the first; its tasks were written into the section before it.',
      'Mermaid gantt text holds one line; line breaks were written as spaces.',
    ]);
    const orphan = writeMermaidGantt(pageOf({ kind: 'gantt', sections: [{ tasks: [{ name: 'X', id: 'x', start: { kind: 'previous' }, end: { kind: 'duration', amount: 1, unit: 'd' } }] }] }));
    expect(orphan).toEqual({ text: 'gantt\n  X :1d\n', warnings: ['Mermaid gives no id to a first task, or one after a task with none, unless it has a start of its own; those ids were dropped.'] });
    expect(() => writeMermaidGantt({ ...pageOf(data), data: { kind: 'timeline', sections: [] } })).toThrow(/as a gantt only/);
  });

  it('writes no task after an id it dropped: the chain after it follows the task before, and a start naming it does too', () => {
    const d3 = { kind: 'duration', amount: 3, unit: 'd' } as const;
    const data: GanttData = {
      kind: 'gantt',
      sections: [{ tasks: [
        { name: 'Plan', id: 'a', start: { kind: 'previous' }, end: d3 },
        { name: 'Build', id: 'b', start: { kind: 'previous' }, end: d3 },
        { name: 'Ship', start: { kind: 'after', ids: ['b'] }, end: { kind: 'until', ids: ['a'] } },
      ] }],
    };
    const { text, warnings } = writeMermaidGantt(pageOf(data));
    expect(text).toBe('gantt\n  Plan :3d\n  Build :3d\n  Ship :1d\n');
    expect(warnings).toEqual([
      'Mermaid gives no id to a first task, or one after a task with none, unless it has a start of its own; those ids were dropped.',
      'Tasks starting after or ending at a task whose id was dropped follow the task before them, or last a day.',
    ]);
    const tasks = ganttOf(text).sections[0]!.tasks;
    expect(tasks.map((t) => t.start)).toEqual([{ kind: 'previous' }, { kind: 'previous' }, { kind: 'previous' }]);
  });

  it('renames a task id that is a tag word, with a warning, and the starts naming it', () => {
    const data: GanttData = { kind: 'gantt', dateFormat: 'YYYY-MM-DD', sections: [{ tasks: [
      { name: 'A', id: 'done', start: { kind: 'date', date: '2024-01-01' }, end: { kind: 'duration', amount: 3, unit: 'd' } },
      { name: 'B', start: { kind: 'after', ids: ['done'] }, end: { kind: 'duration', amount: 1, unit: 'd' } },
    ] }] };
    const { text, warnings } = writeMermaidGantt({ kind: 'plot', id: 'p', width: 10, height: 10, data });
    const tasks = (readMermaidGantt(text).document.pages[0] as PlotPage).data;
    expect(tasks).toMatchObject({ sections: [{ tasks: [{ name: 'A', id: 'done_1' }, { name: 'B', start: { kind: 'after', ids: ['done_1'] } }] }] });
    expect((tasks as GanttData).sections[0]!.tasks[0]!.tags).toBeUndefined();
    expect(warnings).toContain('Mermaid reads a task id that is a tag word as a tag; those ids were renamed.');
  });

  it('keeps a task named accTitle or accDescr a task', () => {
    const task = (name: string) => ({ name, start: { kind: 'date' as const, date: '2024-01-01' }, end: { kind: 'duration' as const, amount: 1, unit: 'd' as const } });
    const data: GanttData = { kind: 'gantt', dateFormat: 'YYYY-MM-DD', sections: [{ tasks: [task('accTitle'), task('accDescr')] }] };
    expect(ganttOf(writeMermaidGantt(pageOf(data)).text).sections[0]!.tasks.map((t) => t.name)).toEqual(['accTitle', 'accDescr']);
  });

  it('warns of a page name its title does not match', () => {
    const data: GanttData = { kind: 'gantt', sections: [] };
    expect(writeMermaidGantt({ ...pageOf(data), name: 'Q3 plan' }).warnings).toContain('Mermaid names a chart by its title; a page name the title does not match was dropped.');
  });

  it('renames a task id holding a comma or a space, with a warning, and the starts naming it', () => {
    const data: GanttData = { kind: 'gantt', dateFormat: 'YYYY-MM-DD', sections: [{ tasks: [
      { name: 'A', id: 'a,b', start: { kind: 'date', date: '2024-01-01' }, end: { kind: 'duration', amount: 3, unit: 'd' } },
      { name: 'B', id: 'c d', start: { kind: 'date', date: '2024-01-02' }, end: { kind: 'duration', amount: 1, unit: 'd' } },
      { name: 'C', start: { kind: 'after', ids: ['a,b', 'c d'] }, end: { kind: 'duration', amount: 1, unit: 'd' } },
    ] }] };
    const { text, warnings } = writeMermaidGantt(pageOf(data));
    expect(ganttOf(text).sections[0]!.tasks).toMatchObject([{ id: 'a_b' }, { id: 'c_d' }, { start: { kind: 'after', ids: ['a_b', 'c_d'] } }]);
    expect(warnings).toContain('Mermaid task ids hold no commas or spaces; those ids were renamed.');
  });
});

describe('the Mermaid format', () => {
  it('reads a gantt by its header and writes a plot page as one', async () => {
    const { document } = await DIAGRAM_MERMAID.read!(fixture('project.mmd'));
    expect(document.pages[0]!.kind).toBe('plot');
    expect(DIAGRAM_MERMAID.write!(document).text.startsWith('gantt\n')).toBe(true);
  });
});
