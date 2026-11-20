import { describe, expect, it } from 'vitest';
import { parseGanttDate } from './dates';
import { addGanttDuration, ganttDurationBetween } from './schedule';

const at = (date: string) => parseGanttDate(date, 'YYYY-MM-DD')!;
const none = () => false;

describe('gantt month durations', () => {
  it('holds a month-end start to the target month’s last day, as Day.js adds months', () => {
    expect(addGanttDuration(at('2024-01-31'), 1, 'M', none)).toBe(at('2024-02-29'));
    expect(addGanttDuration(at('2024-03-31'), 1, 'M', none)).toBe(at('2024-04-30'));
    expect(addGanttDuration(at('2024-02-29'), 1, 'y', none)).toBe(at('2025-02-28'));
    expect(addGanttDuration(at('2024-01-15'), 2, 'M', none)).toBe(at('2024-03-15'));
  });

  it('reads back the months a span was drawn from', () => {
    expect(ganttDurationBetween(at('2024-01-31'), at('2024-02-29'), 'M', none)).toBe(1);
    expect(ganttDurationBetween(at('2024-01-01'), at('2024-12-01'), 'M', none)).toBe(11);
    expect(ganttDurationBetween(at('2024-02-29'), at('2025-02-28'), 'y', none)).toBe(1);
  });
});

describe('ganttDurationBetween', () => {
  const weekends = (t: number) => [0, 6].includes(new Date(t).getUTCDay());

  it('counts calendar days past the span addGanttDuration walks, as it does', () => {
    const start = at('2024-01-01');
    expect(ganttDurationBetween(start, addGanttDuration(start, 150_000, 'd', weekends), 'd', weekends)).toBe(150_000);
  });

  it('counts only days not excluded up to that span', () => {
    const start = at('2024-01-01');
    expect(ganttDurationBetween(start, addGanttDuration(start, 99_000, 'd', weekends), 'd', weekends)).toBe(99_000);
    expect(ganttDurationBetween(start, addGanttDuration(start, 10, 'd', weekends), 'd', weekends)).toBe(10);
  });
});
