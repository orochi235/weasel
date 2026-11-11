/** Counterexamples the gantt property tests shrank to, kept as plain examples. */
import { describe, expect, it } from 'vitest';
import { parseGanttDate } from './dates';
import { scheduleGantt } from './schedule';
import { removeGanttTask, setGanttTaskId } from './structure';
import { formatGanttEnd, parseGanttEnd } from './text';
import type { GanttData } from './types';

describe('gantt, shrunk', () => {
  it('refuses epoch digits past what a number holds', () => {
    expect(parseGanttDate(`-${'9'.repeat(400)}`, 'x')).toBeNull();
    expect(parseGanttDate('1e400', 'X')).toBeNull();
    expect(parseGanttDate(`1${'0'.repeat(306)}`, 'X')).toBeNull();
  });

  it('writes a duration in digits a duration reads back', () => {
    for (const amount of [5e-324, 1e-7, 1e21, 1.5e300]) {
      expect(parseGanttEnd(formatGanttEnd({ kind: 'duration', amount, unit: 'ms' }))).toEqual({ kind: 'duration', amount, unit: 'ms' });
    }
    expect(formatGanttEnd({ kind: 'duration', amount: 1e-7, unit: 'd' })).toBe('0.0000001d');
  });

  it('spans a domain past a single instant for a task too far out for a day to move it', () => {
    const { domain } = scheduleGantt({
      kind: 'gantt', dateFormat: 'x',
      sections: [{ tasks: [{ name: 'a', start: { kind: 'date', date: `1${'0'.repeat(25)}` }, end: { kind: 'date', date: '0' } }] }],
    });
    expect(domain[1]).toBeGreaterThan(domain[0]);
  });

  it('keeps a dependency on an id two tasks hold while one of them still holds it, and with the first', () => {
    const day = { kind: 'duration', amount: 1, unit: 'd' } as const;
    const data: GanttData = { kind: 'gantt', sections: [{ tasks: [
      { name: 'a', id: 't1', start: { kind: 'date', date: '2024-01-01' }, end: day },
      { name: 'b', id: 't1', start: { kind: 'date', date: '2024-02-01' }, end: day },
      { name: 'c', start: { kind: 'after', ids: ['t1'] }, end: day },
    ] }] };
    expect(removeGanttTask(data, 0, 1).sections[0]!.tasks[1]!.start).toEqual({ kind: 'after', ids: ['t1'] });
    expect(removeGanttTask(data, 0, 0).sections[0]!.tasks[1]!.start).toEqual({ kind: 'after', ids: ['t1'] });
    expect(setGanttTaskId(data, 0, 1, 't9').sections[0]!.tasks[2]!.start).toEqual({ kind: 'after', ids: ['t1'] });
    expect(setGanttTaskId(data, 0, 0, 't9').sections[0]!.tasks[2]!.start).toEqual({ kind: 'after', ids: ['t9'] });
  });
});
