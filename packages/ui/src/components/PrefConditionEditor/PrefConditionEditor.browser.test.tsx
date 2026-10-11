import '@weasel-js/theme/tokens.css';
import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, expect, test } from 'vitest';
import type { PrefCondition, PrefGroup, PrefLeaf } from '@weasel-js/prefs';
import { PrefConditionEditor } from './PrefConditionEditor';

// Whether a row's controls wrap inside a narrow column or push it wider is layout, which jsdom does not do.
// The test page is 414px wide, so that is as wide a column as these can ask about.

afterEach(cleanup);

const SCHEMA: PrefGroup = { name: 'Root', children: {
  canvas: { name: 'Canvas', children: {
    showGrid: { kind: 'boolean', name: 'Show grid', description: '', default: true },
    units: { kind: 'enum', name: 'Units', description: '', default: 'px', options: [{ value: 'px', label: 'Pixels' }, { value: 'mm', label: 'Millimeters' }, { value: 'in', label: 'Inches' }] } as PrefLeaf,
    gridSize: { kind: 'number', name: 'Grid size', description: '', default: 8 },
  } },
} };
const VALUE: PrefCondition = { all: [
  { path: 'canvas.showGrid', is: true },
  { path: 'canvas.units', in: ['mm', 'in'] },
  { path: 'canvas.gridSize', atLeast: 4 },
  { not: { any: [{ path: 'canvas.units', is: 'px' }, { path: 'canvas.gridSize', above: 64 }] } },
  { path: 'canvas.snapping', is: true },
] };

const box = (el: Element) => el.getBoundingClientRect();
const row = (n: number) => screen.getByRole('group', { name: `Condition ${n}` });

test.each([200, 300, 400])('every row stays inside a column %ipx wide, its remove button at the end of its first line', (width) => {
  const { container } = render(<div style={{ width }}>
    <PrefConditionEditor aria-label="Shown if" schema={SCHEMA} value={VALUE} onChange={() => {}} />
  </div>);
  const frame = box(container.firstElementChild!);
  expect(frame.width).toBeCloseTo(width, 0);
  expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(document.documentElement.clientWidth);
  for (let n = 1; n <= 5; n++) {
    const r = row(n);
    for (const el of [r, ...r.querySelectorAll('button, input, p, code')]) {
      const b = box(el);
      if (b.width === 0) continue;
      expect(b.left).toBeGreaterThanOrEqual(frame.left - 0.5);
      expect(b.right).toBeLessThanOrEqual(frame.right + 0.5);
    }
    const remove = box(within(r).getByRole('button', { name: `Remove condition ${n}` }));
    expect(remove.right).toBeCloseTo(frame.right, 0);
    expect(remove.top - box(r).top).toBeLessThan(8);
  }
});

test('what is wrong with a row is drawn under its controls, in the danger color', () => {
  render(<div style={{ width: 400 }}><PrefConditionEditor aria-label="Shown if" schema={SCHEMA} value={VALUE} onChange={() => {}} /></div>);
  const message = screen.getByText(/no leaf holds a value/);
  expect(row(5).contains(message)).toBe(true);
  expect(box(message).height).toBeGreaterThan(0);
  expect(box(message).top).toBeGreaterThanOrEqual(box(within(row(5)).getByRole('button', { name: /pref/ })).bottom);
  expect(getComputedStyle(message).color).not.toBe(getComputedStyle(row(1)).color);
});

test('a pref and its comparison share a line where the column has room, and the pref takes its own where it has not', () => {
  const at = (width: number) => {
    cleanup();
    render(<div style={{ width }}>
      <PrefConditionEditor aria-label="Shown if" schema={SCHEMA} value={VALUE} onChange={() => {}} />
    </div>);
    const pref = box(within(row(1)).getByRole('button', { name: /pref/ }));
    const comparison = box(within(row(1)).getByRole('button', { name: /comparison/ }));
    return { pref, comparison };
  };
  const wide = at(400);
  expect(wide.comparison.top).toBeCloseTo(wide.pref.top, 0);
  expect(wide.comparison.left).toBeGreaterThanOrEqual(wide.pref.right);
  const narrow = at(200);
  expect(narrow.comparison.top).toBeGreaterThanOrEqual(narrow.pref.bottom);
});
