import '@weasel-js/theme/tokens.css';
import { cleanup, screen } from '@testing-library/react';
import { afterEach, expect, test } from 'vitest';
import { page } from 'vitest/browser';
import type { PrefGroup } from '@weasel-js/prefs';
import { prefDropTargetAt } from './dropTarget';
import { PrefsForm } from './PrefsForm';
import { renderWithIcons } from '../../testing/withIcons';

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
  renderWithIcons(
    <div style={{ width: 820, height: 400 }}>
      <PrefsForm layout="rail" rowsAcross={2} schema={SCHEMA} values={{}} selected={['view.glue']} onChange={() => {}} />
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

const WIDE: PrefGroup = {
  name: 'Prefs',
  children: {
    view: {
      name: 'View',
      children: {
        grid: flag('Grid'),
        rulers: flag('Rulers'),
        glue: {
          name: 'Glued',
          as: 'fragment',
          children: {
            snap: flag('Snap'),
            globs: { kind: 'list', name: 'Globs', description: '', default: ['a'], item: { kind: 'string', name: 'Glob', description: '', default: '' } },
            guides: flag('Guides'),
          },
        },
      },
    },
  },
};

test('a wide row inside a fragment spans both columns of a form two rows across', async () => {
  await page.viewport(900, 500);
  renderWithIcons(
    <div style={{ width: 820, height: 400 }}>
      <PrefsForm layout="rail" rowsAcross={2} schema={WIDE} values={{}} onChange={() => {}} />
    </div>,
  );
  const globs = document.querySelector('[data-pref-path="view.glue.globs"]')!.getBoundingClientRect();
  expect(Math.abs(globs.left - box('Grid').left)).toBeLessThan(2);
  expect(globs.right).toBeGreaterThan(box('Rulers').right - 2);
  // Snap is alone on its line before it, and Guides starts the line after.
  expect(globs.top).toBeGreaterThan(box('Snap').bottom - 1);
  expect(box('Guides').top).toBeGreaterThan(globs.bottom - 1);
});

test('a drag over the gap between two rows of a fragment lands beside one of them', async () => {
  await page.viewport(900, 500);
  const { container } = renderWithIcons(
    <div style={{ width: 820, height: 400 }}>
      <PrefsForm layout="rail" schema={SCHEMA} values={{}} onChange={() => {}} />
    </div>,
  );
  const snap = box('Snap');
  const guides = box('Guides');
  expect(guides.top - snap.bottom).toBeGreaterThan(2);
  const mark = prefDropTargetAt(container, snap.left + 20, (snap.bottom + guides.top) / 2);
  expect(['view.glue.snap', 'view.glue.guides']).toContain(mark?.path);
  expect(mark?.where).not.toBe('into');
});
