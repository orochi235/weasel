import { render, screen } from '@testing-library/react';
import { expect, test } from 'vitest';
import { ShortcutKeys } from '../Keycaps';
import { ListPane } from './PaneHeader';

test("a titled list's header sits beside what scrolls, not inside it", () => {
  render(<ListPane title="Unplaced" className="x"><p>row</p></ListPane>);
  const header = screen.getByRole('heading', { name: 'Unplaced' }).closest('header')!;
  const body = screen.getByText('row').parentElement!;
  expect(body.contains(header)).toBe(false);
  expect(header.parentElement).toBe(body.parentElement);
});

test('a shortcut in a list is outlined keycaps in the UI font, a cap for each key', () => {
  const { container } = render(<ShortcutKeys legend="⇧⌘Z" />);
  const caps = [...container.querySelectorAll<HTMLElement>('[data-variant]')];
  expect(caps.map((c) => c.textContent)).toEqual(['⇧', '⌘', 'Z']);
  for (const cap of caps) {
    expect(cap.dataset.variant).toBe('minimal');
    expect(cap.style.fontFamily).toBe('var(--wzl-font-ui)');
  }
});
