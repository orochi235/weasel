import '@weasel-js/theme/tokens.css';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, expect, it } from 'vitest';
import { Input } from '../Input';
import { MotifFrame } from './MotifFrame';
import { notch, rule, stereo, tab } from './motifs';

// A field's frame and a frame's fill both default to the sunken surface, and only a browser resolves the
// custom properties that say which color each one ends up.

afterEach(() => {
  cleanup();
  document.documentElement.removeAttribute('data-wzl-mode');
  document.body.style.background = '';
});

const PAINTED = /rgba?\((?!0, 0, 0, 0\))/;
/** The first background painted at or above `el`. */
function fillOf(el: Element | null): string {
  for (let at = el; at !== null; at = at.parentElement) {
    const fill = getComputedStyle(at).backgroundColor;
    if (PAINTED.test(fill)) return fill;
  }
  return '';
}

for (const mode of ['light', 'dark']) {
  it.each([rule(), stereo(), tab(), notch()])(`sets a field apart from what a $id frame draws behind it, in ${mode} mode`, (motif) => {
    document.documentElement.setAttribute('data-wzl-mode', mode);
    document.body.style.background = 'var(--wzl-surface)';
    render(
      <MotifFrame title="Edge" motif={motif}>
        <Input aria-label="Name" value="card" onChange={() => {}} />
      </MotifFrame>,
    );
    const field = screen.getByRole('textbox', { name: 'Name' });
    let frame: Element = field;
    while (!PAINTED.test(getComputedStyle(frame).backgroundColor)) frame = frame.parentElement!;
    expect(frame).not.toBe(document.body);
    expect(getComputedStyle(frame).backgroundColor).not.toBe(fillOf(frame.parentElement));
  });
}
