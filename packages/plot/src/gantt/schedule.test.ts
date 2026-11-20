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
