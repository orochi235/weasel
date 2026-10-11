import '@weasel-js/theme/tokens.css';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, expect, test } from 'vitest';
import { page } from 'vitest/browser';
import type { PrefGroup } from '@weasel-js/prefs';
import { PrefsForm } from './PrefsForm';

// A fragment has no box (`display: contents`), so whether its rows take cells in the grid around them, and
// whether a selected one shows any mark, are layout's to answer.

afterEach(cleanup);

const flag = (name: string) => ({ kind: 'boolean', name, description: '', default: false }) as const;

const SCHEMA: PrefGroup = {
  name: 'Prefs',
  children: {
    view: {
      name: 'View',
      children: {
        grid: flag('Grid'),
        glue: { name: 'Glued', as: 'fragment', children: { snap: flag('Snap'), guides: flag('Guides') } },
        rulers: flag('Rulers'),
      },
    },
  },
};

const slot = (name: string): Element => screen.getByText(name).closest('[data-pref-path]')!;
const box = (name: string): DOMRect => slot(name).getBoundingClientRect();

test('a fragment\'s rows take cells among their neighbors\' in a form two rows across', async () => {
  await page.viewport(900, 500);
  render(
    <div style={{ width: 820, height: 400 }}>
      <PrefsForm layout="rail" rowsAcross={2} schema={SCHEMA} values={{}} selected="view.glue" onChange={() => {}} />
    </div>,
  );
  // Grid | Snap on the first line, Guides | Rulers on the second.
  expect(Math.abs(box('Snap').top - box('Grid').top)).toBeLessThan(2);
  expect(box('Snap').left).toBeGreaterThan(box('Grid').right - 1);
  expect(Math.abs(box('Guides').left - box('Grid').left)).toBeLessThan(2);
  expect(box('Guides').top).toBeGreaterThan(box('Grid').bottom - 1);
  expect(Math.abs(box('Rulers').top - box('Guides').top)).toBeLessThan(2);
  // Selected, it marks the rows it holds and no others.
  const outlined = (name: string): boolean => getComputedStyle(slot(name)).outlineStyle === 'solid';
  expect([outlined('Grid'), outlined('Snap'), outlined('Guides'), outlined('Rulers')]).toEqual([false, true, true, false]);
});
