import '@weasel-js/theme/tokens.css';
import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, expect, test } from 'vitest';
import { useState } from 'react';
import { ItemList } from './ItemList';

// Whether focus survives the focused element leaving the page is the browser's answer, not jsdom's.

afterEach(cleanup);

/** A list whose rows each carry the consumer's own remove button. */
function Removable({ ids }: { ids: string[] }) {
  const [rows, setRows] = useState(ids);
  return (
    <>
      <button type="button">outside</button>
      <ItemList
        containerProps={{ 'aria-label': 'Items' }}
        rows={rows.map((id) => ({
          id,
          label: id,
          trailing: <button type="button" aria-label={`Remove ${id}`} onClick={() => setRows((r) => r.filter((x) => x !== id))}>x</button>,
        }))}
      />
    </>
  );
}

/** A selectable list with no controls, drawn from `ids`. */
const options = (ids: string[]) => (
  <ItemList selection="single" rows={ids.map((id) => ({ id, label: id }))} containerProps={{ 'aria-label': 'Items' }} />
);

const cell = (name: string) => screen.getByRole('gridcell', { name });
const remove = (name: string) => screen.getByRole('button', { name: `Remove ${name}` });
const press = (el: HTMLElement) => act(() => { el.focus(); el.click(); });

test('a row removed by its own control hands focus to the row that took its place', () => {
  render(<Removable ids={['a', 'b', 'c']} />);
  press(remove('b'));
  expect(document.activeElement).toBe(cell('c'));
});

test('the last row removed by its own control hands focus to the row above', () => {
  render(<Removable ids={['a', 'b', 'c']} />);
  press(remove('c'));
  expect(document.activeElement).toBe(cell('b'));
});

test('the next arrow key after a removal moves on from the row focus landed on', () => {
  render(<Removable ids={['a', 'b', 'c']} />);
  press(remove('a'));
  act(() => { document.activeElement!.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true })); });
  expect(document.activeElement).toBe(cell('c'));
});

test('an option removed while it holds focus hands focus to the next option', () => {
  const { rerender } = render(options(['a', 'b', 'c']));
  screen.getByRole('option', { name: 'b' }).focus();
  rerender(options(['a', 'c']));
  expect(document.activeElement).toBe(screen.getByRole('option', { name: 'c' }));
});

test('a row removed while focus is outside the list leaves focus there', () => {
  render(<Removable ids={['a', 'b', 'c']} />);
  act(() => { cell('b').focus(); });
  const outside = screen.getByRole('button', { name: 'outside' });
  act(() => { outside.focus(); remove('b').click(); });
  expect(document.activeElement).toBe(outside);
});
