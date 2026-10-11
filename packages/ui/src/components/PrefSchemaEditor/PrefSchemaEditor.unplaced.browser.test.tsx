import '@weasel-js/theme/tokens.css';
import { act, cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, beforeAll, expect, test } from 'vitest';
import { page } from 'vitest/browser';
import type { PrefGroup } from '@weasel-js/prefs';
import { PrefSchemaEditor } from './PrefSchemaEditor';
import { grip, pointer, pointIn } from './pointerDrag.fixture';

// Where the Unplaced list's drop outline falls against its heading is the browser's layout to say.

beforeAll(() => page.viewport(1500, 800));
afterEach(cleanup);

const leaf = (name: string) => ({ kind: 'boolean', name, description: '', default: false }) as const;
const START: PrefGroup = {
  name: 'Prefs',
  children: { view: { name: 'View', children: { grid: leaf('Show grid'), snap: leaf('Snap') } }, loose: leaf('Loose') },
};

const treeRow = (key: string) =>
  within(screen.getByRole('tree', { name: 'Schema structure' })).getByText(`(${key})`).closest('[role="treeitem"]')!.firstElementChild as HTMLElement;
const heading = () => screen.getByRole('heading', { name: 'Unplaced' });
/** The list's box: the heading sits in its header, and the header in the box a drop is outlined on. */
const area = () => heading().parentElement!.parentElement!;
const textBox = (el: Element) => {
  const range = document.createRange();
  range.selectNodeContents(el);
  return range.getBoundingClientRect();
};

test('the outline a drag draws on the Unplaced list covers none of its heading, and nothing moves when it appears', () => {
  render(<div style={{ height: 700 }}><PrefSchemaEditor schema={START} onChange={() => {}} /></div>);
  const before = textBox(heading());
  const from = treeRow('grid');
  const press = grip(from);
  const end = pointIn(area(), 0.5, 0.7);
  act(() => pointer('pointerdown', from, press));
  for (let i = 1; i <= 8; i++) act(() => pointer('pointermove', document, { x: press.x + ((end.x - press.x) * i) / 8, y: press.y + ((end.y - press.y) * i) / 8 }));
  expect(area()).toHaveAttribute('data-drop');
  const style = getComputedStyle(area());
  expect(style.outlineStyle).toBe('solid');
  // An outline set in from the edge reaches as far into the box as its offset.
  const reach = Math.max(0, -parseFloat(style.outlineOffset));
  const box = area().getBoundingClientRect();
  const text = textBox(heading());
  expect(text.left - box.left).toBeGreaterThanOrEqual(reach + 2);
  expect(text.top - box.top).toBeGreaterThanOrEqual(reach + 2);
  expect([text.left, text.top, text.width]).toEqual([before.left, before.top, before.width]);
  act(() => pointer('pointerup', document, { x: press.x, y: press.y }));
});
