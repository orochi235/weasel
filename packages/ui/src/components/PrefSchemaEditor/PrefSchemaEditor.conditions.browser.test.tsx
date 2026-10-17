import '@weasel-js/theme/tokens.css';
import { cleanup, fireEvent, screen, within } from '@testing-library/react';
import { afterEach, expect, test } from 'vitest';
import { page } from 'vitest/browser';
import type { PrefGroup, PrefLeaf } from '@weasel-js/prefs';
import { PrefSchemaEditor } from './PrefSchemaEditor';
import { renderWithIcons } from '../../testing/withIcons';

// Whether a condition's rows fit the attributes pane's control column, and whether a tree row has room for its
// mark, is layout, which jsdom does not do.

afterEach(cleanup);

const SCHEMA: PrefGroup = {
  name: 'Prefs',
  children: { view: { name: 'View', children: {
    units: { kind: 'enum', name: 'Units', description: '', default: 'px', options: [{ value: 'px', label: 'Pixels' }, { value: 'mm', label: 'Millimeters' }] } as PrefLeaf,
    size: {
      kind: 'number', name: 'Grid size', description: '', default: 8,
      showIf: { all: [{ path: 'view.units', in: ['mm'] }, { path: 'view.gone', is: true }] },
      enableIf: { path: 'view.units', isNot: 'px' },
    },
  } } },
};

const box = (el: Element) => el.getBoundingClientRect();

test('a condition\'s rows stay inside the attributes pane, and the tree row holding a bad one shows its mark', async () => {
  await page.viewport(1300, 720);
  renderWithIcons(<div style={{ width: 1280, height: 700 }}><PrefSchemaEditor schema={SCHEMA} onChange={() => {}} /></div>);
  const tree = screen.getByRole('tree', { name: 'Schema structure' });
  const mark = within(tree).getByText('bad condition');
  const structure = box(screen.getByRole('region', { name: 'Structure' }));
  expect(box(mark).width).toBeGreaterThan(0);
  expect(box(mark).right).toBeLessThanOrEqual(structure.right);
  expect(mark.closest('[data-tree-id]')!.getAttribute('data-tree-id')).toBe('view/size');

  fireEvent.click(within(tree).getByText('Grid size'));
  const pane = screen.getByRole('region', { name: 'Attributes' });
  const paneBox = box(pane);
  expect(pane.scrollWidth).toBeLessThanOrEqual(pane.clientWidth);
  for (const name of ['Shown if', 'Enabled if']) {
    const editor = within(pane).getByRole('group', { name });
    expect(box(editor).width).toBeGreaterThan(120);
    for (const el of [editor, ...editor.querySelectorAll('button, input, p, code')]) {
      const b = box(el);
      if (b.width === 0) continue;
      expect(b.left).toBeGreaterThanOrEqual(paneBox.left - 0.5);
      expect(b.right).toBeLessThanOrEqual(paneBox.right + 0.5);
    }
  }
  const problem = within(pane).getByText(/no leaf holds a value at "view.gone"/);
  expect(box(problem).height).toBeGreaterThan(0);
  expect(within(pane).getByRole('group', { name: 'Shown if' }).contains(problem)).toBe(true);
});
