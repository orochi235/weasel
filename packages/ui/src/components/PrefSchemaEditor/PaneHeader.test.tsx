import { screen } from '@testing-library/react';
import { expect, test } from 'vitest';
import { ShortcutKeys } from '../Keycaps';
import { ListPane } from './PaneHeader';
import { renderWithIcons } from '../../testing/withIcons';

test("a titled list's header sits beside what scrolls, not inside it", () => {
  renderWithIcons(<ListPane title="Unplaced" className="x"><p>row</p></ListPane>);
  const header = screen.getByRole('heading', { name: 'Unplaced' }).closest('header')!;
  const body = screen.getByText('row').parentElement!;
  expect(body.contains(header)).toBe(false);
  expect(header.parentElement).toBe(body.parentElement);
});

test('a shortcut in a list is outlined keycaps, a cap for each key, its font left to the stylesheet', () => {
  const { container } = renderWithIcons(<ShortcutKeys legend="⇧⌘Z" />);
  const caps = [...container.querySelectorAll<HTMLElement>('kbd')];
  expect(caps.map((c) => c.textContent)).toEqual(['⇧', '⌘', 'Z']);
  for (const cap of caps) {
    expect(cap.hasAttribute('data-variant')).toBe(false);
    expect(cap.style.fontFamily).toBe('');
  }
});
