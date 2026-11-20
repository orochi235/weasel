/** CoordTable's rows across reads, as the Dispatch tab hands them over. */
import { afterEach, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { CoordTable, type CoordEntry } from './CoordTable';
import { sequenced } from './sequenced';

afterEach(cleanup);

const entry = (ts: number): CoordEntry => ({
  ts, clientX: ts, clientY: 0, view: null, world: { x: -ts, y: 0 }, fallback: true,
});

it('keeps a row mounted while the window slides past the records before it', () => {
  const all = sequenced(Array.from({ length: 101 }, (_, i) => entry(1000 + i)), 101);
  const { rerender } = render(<CoordTable entries={all.slice(0, 100)} now={2000} />);
  const row = screen.getByText(/^\s*1050\.0 /).closest('tr');
  rerender(<CoordTable entries={all.slice(1)} now={2000} />);
  expect(screen.getByText(/^\s*1050\.0 /).closest('tr')).toBe(row);
});
