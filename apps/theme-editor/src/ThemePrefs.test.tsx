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
