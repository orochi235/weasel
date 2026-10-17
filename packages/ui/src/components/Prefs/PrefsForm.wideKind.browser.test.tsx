import '@weasel-js/theme/tokens.css';
import { cleanup, screen } from '@testing-library/react';
import type { PrefCondition, PrefGroup, PrefLeaf } from '@weasel-js/prefs';
import { afterEach, beforeAll, expect, it } from 'vitest';
import { page } from 'vitest/browser';
import { PrefConditionEditor } from '../PrefConditionEditor';
import { PrefsForm, type PrefRenderer } from './PrefsForm';
import { renderWithIcons } from '../../testing/withIcons';

// Where a row's label sits and how wide its control runs is layout, which jsdom does not do.

beforeAll(() => page.viewport(900, 600));
afterEach(cleanup);

const TARGETS: PrefGroup = {
  name: '',
  children: { units: { kind: 'enum', name: 'Units', description: '', default: 'px', options: [{ value: 'px', label: 'Pixels' }, { value: 'mm', label: 'Millimeters' }] } as PrefLeaf },
};
const SHOWN: PrefCondition = { path: 'units', is: 'mm' };

const condition = (wide: boolean): PrefRenderer =>
  Object.assign<PrefRenderer, { group: boolean; wide: boolean }>(
    ({ pref, value, setValue }) => <PrefConditionEditor aria-label={pref.name} schema={TARGETS} value={value as PrefCondition | undefined} onChange={setValue} />,
    { group: true, wide },
  );

const shownIf = { kind: 'condition', name: 'Shown if', description: '', default: undefined } as PrefLeaf;
const plain = { kind: 'number', name: 'Size', description: '', default: 1 } as PrefLeaf;
const top: PrefGroup = { name: 'Attributes', children: { size: plain, showIf: shownIf } };
const nested: PrefGroup = {
  name: 'Attributes',
  children: { own: { kind: 'object', name: 'Own', description: '', default: {}, block: true, children: { size: plain, showIf: shownIf } } as PrefLeaf },
};

const box = (el: Element) => el.getBoundingClientRect();
const parts = () => ['pref', 'comparison', 'value'].map((part) => box(screen.getByLabelText(`Condition 1 ${part}`)));

function mount(schema: PrefGroup, wide: boolean, values: unknown) {
  const { container } = renderWithIcons(
    <div style={{ width: 520 }}>
      <PrefsForm layout="list" schema={schema} values={values} onChange={() => {}} renderers={{ condition: condition(wide) }} />
    </div>,
  );
  return container.firstElementChild as HTMLElement;
}

it.each([
  ['a row of the form', top, { showIf: SHOWN }],
  ['a field of an object leaf', nested, { own: { showIf: SHOWN } }],
])('gives a kind that asks the whole width, its label above it: %s', (_, schema, values) => {
  const pane = box(mount(schema, true, values));
  const editor = box(screen.getByRole('group', { name: 'Shown if' }));
  const label = box(screen.getByText('Shown if'));
  expect(label.bottom).toBeLessThanOrEqual(editor.top + 0.5);
  expect(editor.width).toBeGreaterThan(pane.width * 0.9);
  // A test's pref, comparison, and value share one line at this width.
  const [pref, comparison, value] = parts();
  expect(Math.abs(comparison!.top - pref!.top)).toBeLessThan(2);
  expect(Math.abs(value!.top - pref!.top)).toBeLessThan(2);
  expect(comparison!.left).toBeGreaterThanOrEqual(pref!.right);
  expect(value!.left).toBeGreaterThanOrEqual(comparison!.right);
  // A row that did not ask keeps its label beside its control.
  const size = box(screen.getByRole('spinbutton', { name: 'Size' }));
  expect(box(screen.getByText('Size')).right).toBeLessThanOrEqual(size.left + 0.5);
});

it('keeps a kind that does not ask in the control column, where the same test wraps', () => {
  mount(top, false, { showIf: SHOWN });
  const editor = box(screen.getByRole('group', { name: 'Shown if' }));
  expect(box(screen.getByText('Shown if')).right).toBeLessThanOrEqual(editor.left + 0.5);
  const [pref, comparison] = parts();
  expect(comparison!.top).toBeGreaterThan(pref!.bottom - 1);
});
