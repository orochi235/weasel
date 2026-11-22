/** CoordTable's rows across reads, as the Dispatch tab hands them over. */
import { afterEach, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { CoordTable, type CoordEntry } from './CoordTable';
import { sequenced } from './sequenced';

afterEach(cleanup);

const entry = (ts: number): CoordEntry => ({
  ts, clientX: ts, clientY: 0, rect: null, view: null, world: { x: -ts, y: 0 }, fallback: true,
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

it("shows where the canvas sat on the page, so a client point can be reconciled with its world point", () => {
  const e: CoordEntry = {
    ...entry(1000),
    rect: { left: 250, top: 180, width: 800, height: 600 },
    view: { x: 0, y: 0, scaleX: 1, scaleY: 1 },
    fallback: false,
  };
  render(<CoordTable entries={sequenced([e], 1)} now={2000} />);
  expect(screen.getByRole('columnheader', { name: 'Canvas' })).toBeTruthy();
  expect(screen.getByText(/^\s*250\.0\s+180\.0$/)).toBeTruthy();
});

it('pads a column to its widest value, so far-from-origin rows keep their decimal points lined up', () => {
  const far = (x: number, seq: number) => ({ seq, record: { ...entry(1000), world: { x, y: 0 } } });
  render(<CoordTable entries={[far(5, 0), far(-1234567.8, 1)]} now={2000} />);
  const cells = [screen.getByText(/^\s*5\.0 /), screen.getByText(/^-1234567\.8 /)];
  expect(cells[0].textContent!.length).toBe(cells[1].textContent!.length);
});
