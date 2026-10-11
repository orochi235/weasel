import '@weasel-js/theme/tokens.css';
import { cleanup, render, screen } from '@testing-library/react';
import type { PrefGroup } from '@weasel-js/prefs';
import { afterEach, expect, it } from 'vitest';
import { PrefsForm } from './PrefsForm';

// A field's frame and an `as: 'panel'` box both default to the sunken surface, and only a browser resolves
// the custom properties that say which color each one ends up.

afterEach(() => {
  cleanup();
  document.documentElement.removeAttribute('data-wzl-mode');
});

const PAINTED = /rgba?\((?!0, 0, 0, 0\))/;
/** The first background painted at or above `el`, up to and including `stop`. */
function fillOf(el: Element, stop: Element): string {
  for (let at: Element | null = el; at !== null; at = at.parentElement) {
    const fill = getComputedStyle(at).backgroundColor;
    if (PAINTED.test(fill) || at === stop) return fill;
  }
  return '';
}

const GROUP: PrefGroup = {
  name: 'Prefs',
  children: {
    card: { name: 'Card', children: { edge: { name: 'Edge', as: 'panel', children: { radius: { kind: 'string', name: 'Radius', description: '', default: '' } } } } },
  },
};

for (const mode of ['light', 'dark']) {
  it(`sets a field in a panel group apart from the panel, in ${mode} mode`, () => {
    document.documentElement.setAttribute('data-wzl-mode', mode);
    render(<PrefsForm schema={GROUP} onChange={() => {}} layout="rail" />);
    const panel = screen.getByRole('region', { name: 'Edge' });
    expect(fillOf(screen.getByRole('textbox', { name: 'Radius' }), panel)).not.toBe(getComputedStyle(panel).backgroundColor);
  });
}
