import '@weasel-js/theme/tokens.css';
import { cleanup, render } from '@testing-library/react';
import { afterEach, expect, test } from 'vitest';
import { ComposeLabView } from './ComposeLabView';

// Whether a panel's controls fit inside it is layout, which jsdom does not do.

afterEach(() => {
  cleanup();
  localStorage.clear();
});

/** Rects compared to a tenth of a pixel, so subpixel rounding is not an overflow. */
const EPS = 0.1;

function overlaps(a: DOMRect, b: DOMRect): boolean {
  return a.left < b.right - EPS && b.left < a.right - EPS && a.top < b.bottom - EPS && b.top < a.bottom - EPS;
}

test.each([480, 360, 720])('at %ipx the settings panels hold their controls and do not overlap', (width) => {
  localStorage.clear();
  const { container } = render(
    <div style={{ width }}>
      <ComposeLabView look="high" variant="solid" label="COMPOSE" />
    </div>,
  );
  const panels = ['Appearance', 'Type & padding']
    .map((title) => [...container.querySelectorAll('h3')].find((h) => h.textContent === title)!.closest('section')!);
  const rects = panels.map((p) => p.getBoundingClientRect());
  expect(overlaps(rects[0]!, rects[1]!), 'the Appearance and Type & padding panels overlap').toBe(false);

  for (const [i, panel] of panels.entries()) {
    const box = rects[i]!;
    for (const control of panel.querySelectorAll('[role="radiogroup"], input, select')) {
      const r = control.getBoundingClientRect();
      const name = control.getAttribute('aria-label') ?? control.textContent ?? control.tagName;
      expect(r.right, `${name} runs past its panel's right edge`).toBeLessThanOrEqual(box.right + EPS);
      expect(r.left, `${name} runs past its panel's left edge`).toBeGreaterThanOrEqual(box.left - EPS);
    }
  }
});
