import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { createMemoryAdapter } from '@weasel-js/storage';
import { resolveTheme, weaselTheme } from '@weasel-js/theme';
import { afterEach, describe, expect, it } from 'vitest';
import { ThemePrefs } from './ThemePrefs';

afterEach(cleanup);

const mount = () => render(<ThemePrefs storage={createMemoryAdapter()} />);

describe('<ThemePrefs>', () => {
  it('lists a page in the rail for each token group', () => {
    mount();
    const rail = screen.getByRole('navigation');
    for (const name of ['Axes', 'Surface', 'Accent', 'Gray']) expect(within(rail).getByText(name)).toBeTruthy();
  });

  it('marks a color that differs by mode with the mode it shows, and opens it to one member per mode', () => {
    mount();
    fireEvent.click(within(screen.getByRole('navigation')).getByText('Surface'));
    expect(screen.getAllByTitle('Mode: Dark').length).toBeGreaterThan(0);
    const [toggle] = screen.getAllByRole('button', { name: /by Mode$/ });
    fireEvent.click(toggle!);
    const members = screen.getByRole('group', { name: toggle!.getAttribute('aria-label') ?? /by Mode$/ });
    expect(within(members).getAllByText(/^(Dark|Light)$/)).toHaveLength(2);
  });

  it('shows a value that refers to a token as a link to that token’s row, and opens its page on a click', () => {
    mount();
    fireEvent.click(within(screen.getByRole('navigation')).getByText('Button'));
    expect(screen.queryByDisplayValue('var(--wzl-fg-on-accent)')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'confirm-fg: the token fg-on-accent' }));
    const row = document.querySelector('[data-pref-path="fg.fg-on-accent"]');
    expect(row).not.toBeNull();
    expect(row!.hasAttribute('data-selected')).toBe(true);
  });

  it('shows a property the theme does not set by its name, and edits the reference as text when asked', () => {
    mount();
    fireEvent.click(within(screen.getByRole('navigation')).getByText('Button'));
    const row = document.querySelector('[data-pref-path="button.button-surface"]') as HTMLElement;
    expect(within(row).getByText('--btn-glass')).toBeTruthy();
    expect(within(row).queryByRole('textbox')).toBeNull();
    fireEvent.click(within(row).getByRole('button', { name: 'Edit surface as text' }));
    expect(within(row).getByRole('textbox')).toHaveValue('var(--btn-glass)');
  });

  it('pins an edit over the theme, and draws the preview in what it pins', () => {
    mount();
    fireEvent.click(within(screen.getByRole('navigation')).getByText('Gray'));
    const field = screen.getByLabelText('50');
    fireEvent.input(field, { target: { value: '#ff3366' } });
    fireEvent.change(field, { target: { value: '#ff3366' } });
    const pinned = document.querySelector('[data-wzl-theme="weasel-prefs"]');
    expect(pinned).not.toBeNull();
    expect(resolveTheme(weaselTheme)['--wzl-gray-50']).not.toBe('#ff3366');
    const rules = [...document.querySelectorAll('style')].map((el) => el.textContent ?? '').join('\n');
    const adopted = (document.adoptedStyleSheets ?? []).flatMap((sheet) => [...sheet.cssRules].map((r) => r.cssText)).join('\n');
    expect(`${rules}\n${adopted}`).toMatch(/weasel-prefs[^{]*\{[^}]*--wzl-gray-50:\s*#ff3366/i);
  });
});
