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

it("shows the camera a conversion was read under: both scales and the offset", () => {
  const e: CoordEntry = { ...entry(1000), view: { x: -40, y: 25, scaleX: 2, scaleY: 0.5 }, fallback: false };
  render(<CoordTable entries={sequenced([e], 1)} now={2000} />);
  expect(screen.getByText(/^\s*2\.000\s+0\.500$/)).toBeTruthy();
  expect(screen.getByText(/^\s*-40\.0\s+25\.0$/)).toBeTruthy();
});
