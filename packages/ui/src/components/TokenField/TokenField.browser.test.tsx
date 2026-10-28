import '@weasel-js/theme/tokens.css';
import { cleanup, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, beforeEach, expect, test } from 'vitest';
import { commands, page } from 'vitest/browser';
import { TokenField } from './TokenField';
import s from './TokenField.browser.test.module.css';

const WORDS = ['alpha', 'bravo', 'charlie', 'delta', 'echo', 'foxtrot', 'golf'];
let last: string[] = [];

function Field() {
  const [value, setValue] = useState(WORDS);
  return (
    <div className={s.narrow}>
      <TokenField aria-label="Word" reorder value={value} onChange={(next) => { last = next; setValue(next); }} />
    </div>
  );
}

type Pt = { x: number; y: number };
const chip = (name: string) => screen.getByRole('button', { name });
const mid = (el: Element): Pt => {
  const r = el.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
};
const steps = (a: Pt, b: Pt, n = 12): Pt[] => Array.from({ length: n + 1 }, (_, i) => ({ x: a.x + ((b.x - a.x) * i) / n, y: a.y + ((b.y - a.y) * i) / n }));
const drag = (path: Pt[]) => commands.pointer([
  { to: [path[0]!.x, path[0]!.y] }, { down: true }, ...path.slice(1).map((p) => ({ to: [p.x, p.y] as [number, number] })), { up: true },
]);

beforeEach(async () => {
  last = [];
  await page.viewport(800, 600);
});
afterEach(cleanup);

test('chips wrap onto lines of their own inside the field', () => {
  render(<Field />);
  expect(chip('golf').getBoundingClientRect().top).toBeGreaterThan(chip('alpha').getBoundingClientRect().bottom);
});

test('a chip dragged onto a later line lands where it is dropped, read line by line', async () => {
  render(<Field />);
  const golf = chip('golf').getBoundingClientRect();
  expect(golf.top).toBeGreaterThan(chip('alpha').getBoundingClientRect().bottom);
  // Into the left half of the last line's last chip: in front of it, after everything on the lines above.
  await drag(steps(mid(chip('alpha')), { x: golf.left + 3, y: golf.top + golf.height / 2 }));
  expect(last).toEqual(['bravo', 'charlie', 'delta', 'echo', 'foxtrot', 'alpha', 'golf']);
});

test('a click on a chip that never drags opens its editor', async () => {
  render(<Field />);
  const p = mid(chip('delta'));
  await commands.pointer([{ to: [p.x, p.y] }, { down: true }, { up: true }]);
  expect(await screen.findByRole('dialog', { name: 'Edit delta' })).toBeTruthy();
  expect(last).toEqual([]);
});
