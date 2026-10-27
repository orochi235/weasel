import '@weasel-js/theme/tokens.css';
import '@weasel-js/labkit/styles.css';
import './app.css';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { IconRegistryProvider } from '@weasel-js/core';
import { createMemoryAdapter } from '@weasel-js/storage';
import { kitIcons } from '@weasel-js/ui/kit-icons';
import { afterEach, expect, test } from 'vitest';
import { page } from 'vitest/browser';
import { ThemePrefs } from './ThemePrefs';

// Whether a row's label line fits its track is layout, so only a real browser can answer it. 880px is the
// viewport the overflow was seen at (2026-10-26).

afterEach(cleanup);

const frame = () => new Promise<void>((done) => requestAnimationFrame(() => requestAnimationFrame(() => done())));
const SLOP = 0.5;

/** Every inline row on the page whose label line runs into its control or past the row, by the row's path. */
function overflowing(): string[] {
  const out: string[] = [];
  for (const row of document.querySelectorAll<HTMLElement>('[data-pref-path] > [data-property-row]')) {
    const path = row.parentElement!.getAttribute('data-pref-path')!;
    const label = row.querySelector<HTMLElement>(':scope > [class*="rowLabel"]');
    const control = row.querySelector<HTMLElement>(':scope > [class*="rowControl"]');
    if (!label || !control) continue;
    const edge = row.getBoundingClientRect().right;
    const controlBox = control.getBoundingClientRect();
    const beside = controlBox.top < label.getBoundingClientRect().bottom - SLOP;
    for (const el of [label, ...label.querySelectorAll<HTMLElement>('*')]) {
      const box = el.getBoundingClientRect();
      if (box.width === 0) continue;
      if (box.right > edge + SLOP || (beside && box.right > controlBox.left + SLOP)) {
        out.push(`${path}: ${el.className || el.tagName} ends at ${box.right.toFixed(1)}, control at ${controlBox.left.toFixed(1)}`);
        break;
      }
    }
    for (const el of control.querySelectorAll<HTMLElement>('*')) {
      if (el.getBoundingClientRect().right > edge + SLOP) {
        out.push(`${path}: ${el.className || el.tagName} in the control runs past the row`);
        break;
      }
    }
  }
  return out;
}

test('at an 880px viewport, no row’s hint, mode chip or split toggle runs into its control', async () => {
  await page.viewport(880, 800);
  const root = document.createElement('div');
  root.id = 'root';
  document.body.append(root);
  render(
    <IconRegistryProvider icons={kitIcons}>
      <ThemePrefs storage={createMemoryAdapter()} />
    </IconRegistryProvider>,
    { container: root },
  );
  await document.fonts.ready;
  const rail = screen.getByRole('navigation');
  const pages = ['Surface', 'Accent', 'Button', 'Fg', 'Control'];
  const found: string[] = [];
  let rows = 0;
  for (const name of pages) {
    fireEvent.click(within(rail).getByText(name));
    await frame();
    rows += document.querySelectorAll('[data-pref-path] > [data-property-row]').length;
    found.push(...overflowing());
  }
  expect(rows).toBeGreaterThan(20);
  expect(found).toEqual([]);
  root.remove();
});
