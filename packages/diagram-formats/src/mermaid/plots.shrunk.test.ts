import { describe, expect, it } from 'vitest';
import type { GanttData, GitGraphData, JourneyData, PlotData, QuadrantData, RadarData, XyChartData } from '@weasel-js/plot';
import type { DiagramDocument, ImportResult, PlotPage } from '../document';
import { DIAGRAM_MERMAID } from './format';

const docOf = (data: PlotData): DiagramDocument => ({ pages: [{ kind: 'plot', id: 'p', width: 800, height: 500, data }] });
const write = (data: PlotData) => DIAGRAM_MERMAID.write!(docOf(data));
const read = (text: string) => ((DIAGRAM_MERMAID.read!(text) as ImportResult).document.pages[0] as PlotPage).data;
const back = (data: PlotData) => read(write(data).text);
const day = { start: { kind: 'date' as const, date: '2024-01-01' }, end: { kind: 'duration' as const, amount: 1, unit: 'd' as const } };

describe('Mermaid charts, shrunk counterexamples', () => {
  it('reads a line separator inside a statement as text, where a reader threw a TypeError', () => {
    expect((read('gantt\n  title a\u2028b\n  a :2024-01-01, 1d\n') as GanttData).title).toBe('a\u2028b');
    expect((read('xychart-beta\n  title "a\u2029b"\n') as XyChartData).title).toBe('a\u2029b');
    expect((read('quadrantChart\n  x-axis a --> b\u2028c\n') as QuadrantData).x).toEqual({ low: 'a', high: 'b\u2028c' });
    expect((read('---\ntitle: "\u2028a"\n---\ngitGraph\n  commit\n') as GitGraphData).title).toBe('\u2028a');
  });

  it('writes a title or a label breaking across lines on lines its reader reads back', () => {
    expect((back({ kind: 'quadrant', title: 'a\nend', points: [] }) as QuadrantData).title).toBe('a end');
    expect((back({ kind: 'xychart', x: { kind: 'band', categories: ['\n'] }, series: [] }) as XyChartData).x).toEqual({ kind: 'band', categories: ['\n'] });
    const radar: RadarData = { kind: 'radar', axes: [{ id: 'a' }], curves: [{ id: 'A', values: [0], label: 'x\ny' }] };
    expect((back(radar) as RadarData).curves[0]!.label).toBe('x y');
    const git = back({ kind: 'gitgraph', commands: [{ kind: 'commit', id: 'c0', tag: '\na' }] }) as GitGraphData;
    expect(git.commands[0]).toMatchObject({ tag: ' a' });
    expect(write({ kind: 'packet', title: 'a\r\nend', fields: [] }).warnings).toContain('Mermaid packet text holds one line; line breaks were written as spaces.');
  });

  it('keeps an "&" before a line break it spells, which read as the entity opening the break (10,000 runs)', () => {
    expect((back({ kind: 'xychart', title: '&&\n', series: [] }) as XyChartData).title).toBe('&&\n');
    expect(back({ kind: 'packet', fields: [{ start: 0, end: 0, label: '&\n' }] })).toMatchObject({ fields: [{ label: '&\n' }] });
  });

  it('keeps a gantt task named for a statement, and a "#58;" typed in a name', () => {
    const data: GanttData = { kind: 'gantt', dateFormat: 'YYYY-MM-DD', sections: [{ name: 'a', tasks: [{ name: 'title', ...day }, { name: 'x #58; %%y', ...day }] }] };
    expect((back(data) as GanttData).sections[0]!.tasks.map((t) => t.name)).toEqual(['title', 'x #58; %%y']);
  });

  it('reads back a quadrant point whose quoted name holds ":["', () => {
    expect((back({ kind: 'quadrant', points: [{ name: ':[\n', x: 0, y: 0.5 }] }) as QuadrantData).points).toEqual([{ name: ':[\n', x: 0, y: 0.5 }]);
  });

  it('reads the curve after one whose label holds a brace', () => {
    const data: RadarData = { kind: 'radar', axes: [{ id: 'a' }], curves: [{ id: 'A', values: [1], label: '{' }, { id: 'B', values: [2] }] };
    expect((back(data) as RadarData).curves.map((c) => [c.id, c.values])).toEqual([['A', [1]], ['B', [2]]]);
  });

  it('writes journey steps named for a comment, a statement, or nothing on lines that read as steps', () => {
    const data: JourneyData = { kind: 'journey', sections: [{ name: 'a', tasks: [
      { name: '%% %%{init}%%', score: 1, actors: [] }, { name: 'title x', score: 2, actors: [] }, { name: '#', score: 3, actors: [] },
    ] }] };
    const { text, warnings } = write(data);
    expect((read(text) as JourneyData).sections[0]!.tasks.map((t) => [t.name, t.score])).toEqual([['{init}%%', 1], ['(untitled)', 3]]);
    expect(warnings).toContain('Mermaid reads a step named "title …" or "section …" as that statement; those steps were dropped.');
  });
});
