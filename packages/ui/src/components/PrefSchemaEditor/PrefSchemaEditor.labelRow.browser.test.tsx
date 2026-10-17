import '@weasel-js/theme/tokens.css';
import { cleanup, fireEvent, screen, within } from '@testing-library/react';
import { afterEach, beforeAll, expect, test } from 'vitest';
import { page } from 'vitest/browser';
import type { PrefLeaf, PrefSection } from '@weasel-js/prefs';
import { PrefSchemaEditor } from './PrefSchemaEditor';
import { renderWithIcons } from '../../testing/withIcons';

// How far a row's selection outline stands from the row under it is a matter of the boxes the preview lays out.

beforeAll(() => page.viewport(1500, 800));
afterEach(cleanup);

const num = (name: string): PrefLeaf => ({ kind: 'number', name, description: '', default: 0 });
const NODE: PrefSection = { name: 'Rect', members: { layout: { name: 'Layout', members: {
  'pose.x': num('X'),
  note: { kind: 'label', name: 'A note among the rows', description: '', default: undefined } as PrefLeaf,
  'pose.y': num('Y'),
  wide: { kind: 'string', name: 'Wide', description: '', default: '', block: true } as PrefLeaf,
  'pose.w': num('W'),
} } } };

const preview = () => screen.getByRole('region', { name: 'Live preview' });
const rowAt = (path: string) => preview().querySelector(`[data-pref-path="${path}"]`) as HTMLElement;
const gapUnder = (path: string, next: string) => rowAt(next).getBoundingClientRect().top - rowAt(path).getBoundingClientRect().bottom;

test('a label row and a block row stand as far from the row under them as any row does', () => {
  renderWithIcons(<div style={{ height: 760 }}><PrefSchemaEditor schema={NODE} onChange={() => {}} /></div>);
  const usual = gapUnder('pose.x', 'note');
  expect(usual).toBeGreaterThan(0);
  expect(gapUnder('note', 'pose.y')).toBe(usual);
  expect(gapUnder('wide', 'pose.w')).toBe(usual);
});

test('a selected label row\'s outline stops short of the label of the row under it', () => {
  renderWithIcons(<div style={{ height: 760 }}><PrefSchemaEditor schema={NODE} onChange={() => {}} /></div>);
  fireEvent.click(within(screen.getByRole('tree', { name: 'Schema structure' })).getByText('note'));
  const row = rowAt('note');
  const style = getComputedStyle(row);
  expect(style.outlineStyle).toBe('solid');
  const edge = row.getBoundingClientRect().bottom + parseFloat(style.outlineOffset) + parseFloat(style.outlineWidth);
  const range = document.createRange();
  range.selectNodeContents(within(rowAt('pose.y')).getByText('Y'));
  expect(range.getBoundingClientRect().top - edge).toBeGreaterThanOrEqual(4);
});
