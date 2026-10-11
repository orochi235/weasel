import '@weasel-js/theme/tokens.css';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, expect, it } from 'vitest';
import { MotifFrame } from '../MotifFrame';

// The rules either side of the title are drawn in one token and the frame's fill in another, and only a
// browser resolves the two to colors that can be told apart or cannot.

afterEach(() => {
  cleanup();
  document.documentElement.removeAttribute('data-wzl-mode');
});

/** `color` painted over `ground`, as the three channels a screen shows. */
function painted(color: string, ground: string): [number, number, number] {
  const ctx = document.createElement('canvas').getContext('2d', { willReadFrequently: true })!;
  for (const fill of [ground, color]) {
    ctx.fillStyle = fill;
    ctx.fillRect(0, 0, 1, 1);
  }
  const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
  return [r, g, b];
}

function luminance(rgb: [number, number, number]): number {
  const [r, g, b] = rgb.map((c) => {
    const v = c / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG's contrast ratio of two colors. */
function contrast(a: [number, number, number], b: [number, number, number]): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

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
      expect(contrast(painted(line, fill), painted(fill, fill))).toBeGreaterThan(1.2);
    }
  });
}
