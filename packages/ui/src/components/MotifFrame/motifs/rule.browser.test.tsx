import '@weasel-js/theme/tokens.css';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, expect, it } from 'vitest';
import { lineContrast } from '../../../testing/paintedContrast';
import { MotifFrame } from '../MotifFrame';

// The rules either side of the title are drawn in one token and the frame's fill in another, and only a
// browser resolves the two to colors that can be told apart or cannot.

afterEach(() => {
  cleanup();
  document.documentElement.removeAttribute('data-wzl-mode');
});

for (const mode of ['light', 'dark']) {
  it(`draws the title's rules in a color that shows on the frame's fill, in ${mode} mode`, () => {
    document.documentElement.setAttribute('data-wzl-mode', mode);
    render(
      <MotifFrame title="Aqua">
        <p>Gloss</p>
      </MotifFrame>,
    );
    const frame = screen.getByRole('group', { name: 'Aqua' });
    const fill = getComputedStyle(frame).backgroundColor;
    const rules = frame.querySelectorAll('h3 > hr');
    expect(rules).toHaveLength(2);
    for (const rule of rules) {
      expect(rule.getBoundingClientRect().width).toBeGreaterThan(0);
      const line = getComputedStyle(rule).borderTopColor;
      expect(lineContrast(line, fill)).toBeGreaterThan(1.2);
    }
  });
}
