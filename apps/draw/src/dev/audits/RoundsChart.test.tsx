import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { RoundsChart, areaRoundsOf } from './RoundsChart';
import type { AuditArea, AuditRound } from './skulkMap.types';

const rounds: AuditRound[] = [
  { round: 1, date: '2026-11-01', areas: 16, files: 400, distinct: 80, est: 120 },
  { round: 2, date: '2026-11-02', areas: 8, files: 200, distinct: 24, est: 40 },
];
const area = {
  id: 'geom.part1', files: 30,
  passes: [
    { round: 1, date: '2026-11-01', a: 4, b: 5, shared: 2, distinct: 7, est: 10, left: 3 },
    { round: 2, date: '2026-11-02', a: 2, b: 1, shared: 1, distinct: 2, est: 2, left: 0, provisional: true },
  ],
} as unknown as AuditArea;

describe('RoundsChart', () => {
  it('draws every round per area, and a picked area its own passes in plain defects', () => {
    const { rerender } = render(<RoundsChart rounds={rounds} />);
    expect(screen.getByRole('img').getAttribute('aria-label')).toBe('Defects found and estimated per area, by round');
    rerender(<RoundsChart rounds={rounds} area={area} />);
    expect(screen.getByRole('img').getAttribute('aria-label')).toBe('Defects found and estimated in geom.part1, by round');
    expect(screen.getByText('defects')).toBeTruthy();
    expect([...document.querySelectorAll('title')].map((t) => t.textContent)).toEqual([
      'round 1: 7 found and 10.0 estimated in geom.part1',
      'round 2 (live): 2 found and 2.0 estimated in geom.part1',
    ]);
  });

  it('turns an area\'s passes into rounds of one area, a live pass pending', () => {
    expect(areaRoundsOf(area).map((r) => [r.round, r.areas, r.distinct, r.est, r.pending])).toEqual([
      [1, 1, 7, 10, undefined], [2, 1, 2, 2, 'live'],
    ]);
  });
});
