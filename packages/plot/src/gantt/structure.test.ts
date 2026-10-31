import { describe, expect, it } from 'vitest';
import { compilePlot } from '../plotData';
import { ganttSchema } from './schema';
import { PLOT_THEME } from '../theme';
import {
  insertGanttSection, insertGanttTask, moveGanttSection, moveGanttTaskToSection, removeGanttSection, removeGanttTask, reorderGanttTask,
  setGanttExcludes, setGanttSetting, setGanttTaskEnd, setGanttTaskId, setGanttTaskStart, setGanttTaskTags,
} from './structure';
import { formatGanttEnd, formatGanttStart, parseGanttEnd, parseGanttStart } from './text';
import type { GanttData } from './types';

const measure = (text: string) => ({ width: text.length * 7, height: 14 });
const compiles = (d: GanttData) => expect(compilePlot(d, { width: 600, height: 400 }, PLOT_THEME, measure).length).toBeGreaterThan(0);
const EMPTY: GanttData = { kind: 'gantt', sections: [] };

const CHAIN: GanttData = {
  kind: 'gantt',
  sections: [
    { name: 'A', tasks: [{ name: 'one', id: 'a1', start: { kind: 'date', date: '2024-01-01' }, end: { kind: 'duration', amount: 2, unit: 'd' } }] },
    { name: 'B', tasks: [
      { name: 'two', start: { kind: 'after', ids: ['a1'] }, end: { kind: 'until', ids: ['a1'] } },
      { name: 'three', start: { kind: 'previous' }, end: { kind: 'duration', amount: 1, unit: 'w' } },
    ] },
  ],
};

describe('gantt structure', () => {
  it('builds a gantt from nothing: a section of one task, then more tasks after it', () => {
    let d = insertGanttSection(EMPTY, 0);
    d = insertGanttTask(d, 0, 1);
    d = setGanttTaskStart(d, 0, 0, { kind: 'date', date: '2024-03-01' });
    expect(d.sections).toEqual([{
      name: 'Section 1',
      tasks: [
        { name: 'Task 1', start: { kind: 'date', date: '2024-03-01' }, end: { kind: 'duration', amount: 1, unit: 'd' } },
        { name: 'Task 2', start: { kind: 'previous' }, end: { kind: 'duration', amount: 1, unit: 'd' } },
      ],
    }]);
    compiles(d);
  });

  it('takes a removed task\'s id out of every dependency on it', () => {
    const d = removeGanttTask(CHAIN, 0, 0);
    expect(d.sections[1]!.tasks[0]).toEqual({ name: 'two', start: { kind: 'previous' }, end: { kind: 'duration', amount: 1, unit: 'd' } });
    expect(removeGanttSection(CHAIN, 0).sections[0]!.tasks[0]!.start).toEqual({ kind: 'previous' });
    compiles(d);
  });

  it('renames an id in every dependency, and refuses one another task holds', () => {
    const d = setGanttTaskId(CHAIN, 0, 0, 'first');
    expect(d.sections[1]!.tasks[0]).toMatchObject({ start: { kind: 'after', ids: ['first'] }, end: { kind: 'until', ids: ['first'] } });
    expect(() => setGanttTaskId(setGanttTaskId(CHAIN, 1, 0, 'b'), 1, 1, 'b')).toThrow(/already has id "b"/);
    expect(() => setGanttTaskId(CHAIN, 1, 0, 'a b')).toThrow(/no spaces/);
  });

  it('moves a task into another section, keeping its id and the dependencies on it', () => {
    const d = moveGanttTaskToSection(CHAIN, 0, 0, 1, 1);
    expect(d.sections.map((s) => s.tasks.map((t) => t.name))).toEqual([[], ['two', 'one', 'three']]);
    expect(d.sections[1]!.tasks[1]!.id).toBe('a1');
    expect(d.sections[1]!.tasks[0]!.start).toEqual({ kind: 'after', ids: ['a1'] });
    expect(moveGanttTaskToSection(CHAIN, 1, 0, 0).sections.map((s) => s.tasks.map((t) => t.name))).toEqual([['one', 'two'], ['three']]);
    expect(moveGanttTaskToSection(CHAIN, 1, 0, 1).sections[1]!.tasks.map((t) => t.name)).toEqual(['three', 'two']);
    expect(() => moveGanttTaskToSection(CHAIN, 0, 0, 5)).toThrow(/no section 5/);
    compiles(d);
  });

  it('offers each section as a choice on a task row, choosing one moving the task there', () => {
    const tasks = ganttSchema.tables[0]!.children![0]!;
    const section = tasks.columns(CHAIN, [1]).find((c) => c.key === 'section')!;
    expect(section.type).toEqual({ kind: 'enum', options: ['1. A', '2. B'] });
    expect(section.get(CHAIN, [1], 0)).toBe('2. B');
    const d = section.set(CHAIN, [1], 0, '1. A');
    expect(d.sections.map((s) => s.tasks.map((t) => t.name))).toEqual([['one', 'two'], ['three']]);
    expect(section.set(CHAIN, [1], 0, 'nowhere')).toBe(CHAIN);
  });

  it('moves sections and tasks', () => {
    expect(moveGanttSection(CHAIN, 0, 1).sections.map((s) => s.name)).toEqual(['B', 'A']);
    expect(reorderGanttTask(CHAIN, 1, 0, 1).sections[1]!.tasks.map((t) => t.name)).toEqual(['three', 'two']);
  });

  it('sets tags in one order, each once, and the chart\'s settings', () => {
    expect(setGanttTaskTags(CHAIN, 0, 0, ['milestone', 'crit', 'crit']).sections[0]!.tasks[0]!.tags).toEqual(['crit', 'milestone']);
    expect(setGanttTaskTags(CHAIN, 0, 0, [])).toBe(CHAIN);
    const d = setGanttExcludes(setGanttSetting(setGanttSetting(CHAIN, 'axisFormat', '%m/%d'), 'todayMarker', 'off'), ['weekends', ' ']);
    expect(d).toMatchObject({ axisFormat: '%m/%d', todayMarker: 'off', excludes: ['weekends'] });
    expect(setGanttExcludes(setGanttSetting(setGanttSetting(d, 'axisFormat', ''), 'todayMarker', undefined), [])).toEqual(CHAIN);
    expect(setGanttTaskEnd(CHAIN, 0, 0, { kind: 'date', date: '2024-01-09' }).sections[0]!.tasks[0]!.end).toEqual({ kind: 'date', date: '2024-01-09' });
    compiles(d);
  });

  it('reads and writes starts and ends as Mermaid writes them', () => {
    for (const text of ['after a b', '2024-01-01', '']) expect(formatGanttStart(parseGanttStart(text))).toBe(text);
    for (const text of ['until a', '3d', '1.5h', '2024-01-01']) expect(formatGanttEnd(parseGanttEnd(text))).toBe(text);
    expect(parseGanttEnd('12ms')).toEqual({ kind: 'duration', amount: 12, unit: 'ms' });
  });
});
