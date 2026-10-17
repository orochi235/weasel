import { cleanup, fireEvent, screen } from '@testing-library/react';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '../App';
import { WeaselDemos } from '../WeaselDemos';
import { MODE_STORAGE_KEY } from '../colorMode';
import '../Shell';
import { renderWithIcons } from '../testIcons';

// `WeaselDemos` builds one; jsdom has none.
beforeAll(() => {
  vi.stubGlobal(
    'IntersectionObserver',
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
      takeRecords() {
        return [];
      }
      root = null;
      rootMargin = '';
      thresholds = [];
    },
  );
});

const mode = () => document.documentElement.getAttribute('data-wzl-mode');

beforeEach(() => {
  window.localStorage.removeItem(MODE_STORAGE_KEY);
  window.history.replaceState(null, '', '/#scene');
});
afterEach(cleanup);

describe('the demo shell color mode', () => {
  it('draws in dark until a reader picks a mode', () => {
    renderWithIcons(<WeaselDemos />);
    expect(mode()).toBe('dark');
    expect(screen.getByRole('radio', { name: 'Dark' })).toHaveAttribute('aria-checked', 'true');
  });

  it('sets the mode a reader picks on the document, and remembers it', () => {
    const first = renderWithIcons(<WeaselDemos />);
    fireEvent.click(screen.getByRole('radio', { name: 'Light' }));
    expect(mode()).toBe('light');
    first.unmount();

    renderWithIcons(<WeaselDemos />);
    expect(mode()).toBe('light');
    expect(screen.getByRole('radio', { name: 'Light' })).toHaveAttribute('aria-checked', 'true');
  });

  it('hands the document back when the shell goes away', () => {
    const shell = renderWithIcons(<WeaselDemos />);
    fireEvent.click(screen.getByRole('radio', { name: 'Light' }));
    shell.unmount();
    expect(mode()).toBeNull();
  });

  it('leaves the front page, which pins its own theme, alone', () => {
    window.history.replaceState(null, '', '/');
    renderWithIcons(<App />);
    expect(mode()).toBeNull();
  });
});
