import '@weasel-js/theme/tokens.css';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, expect, test } from 'vitest';
import { page } from 'vitest/browser';
import type { PrefGroup } from '@weasel-js/prefs';
import { PrefSchemaEditor } from './PrefSchemaEditor';

// Which panes share an edge is the grid's doing, and jsdom lays nothing out.

afterEach(cleanup);

const SCHEMA: PrefGroup = {
  name: 'Prefs',
  children: { view: { name: 'View', children: { grid: { kind: 'boolean', name: 'Show grid', description: '', default: true } } } },
};

const box = (el: Element): DOMRect => el.getBoundingClientRect();

test('the structure pane runs the full height under the bar, and every other pane sits beside it', async () => {
  await page.viewport(1300, 720);
  const { container } = render(
    <div style={{ width: 1280, height: 700 }}>
      <PrefSchemaEditor schema={SCHEMA} onChange={() => {}} />
    </div>,
  );
  const editor = box(container.firstElementChild!.firstElementChild!);
  const bar = box(screen.getByRole('group', { name: 'Schema tools' }));
  const structure = box(screen.getByRole('region', { name: 'Structure' }));
  const attributes = box(screen.getByRole('region', { name: 'Attributes' }));
  const preview = box(screen.getByRole('region', { name: 'Live preview' }));
  const literal = box(screen.getByTestId('schema-literal'));

  expect(structure.top).toBeGreaterThanOrEqual(bar.bottom);
  expect(Math.abs(structure.bottom - editor.bottom)).toBeLessThan(2);
  for (const pane of [attributes, preview, literal]) expect(pane.left).toBeGreaterThanOrEqual(structure.right);
  // The export sits under the attributes and the preview, in the structure's complement.
  expect(literal.top).toBeGreaterThanOrEqual(attributes.bottom);
  expect(literal.bottom).toBeLessThanOrEqual(structure.bottom + 1);
  expect(preview.bottom).toBeLessThan(structure.bottom - 50);
});
