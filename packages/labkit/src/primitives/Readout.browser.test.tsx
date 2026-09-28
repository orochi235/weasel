import '@weasel-js/theme/tokens.css';
import '@weasel-js/theme/fonts.css';
import '../styles.less';
import { cleanup, render } from '@testing-library/react';
import { afterEach, expect, test } from 'vitest';
import { Readout, type ReadoutRow } from './Readout';

function must<T>(el: T | null): T {
  if (el == null) throw new Error('expected an element');
  return el;
}

// Right alignment, the figure column's minimum width and a height that holds
// while values come and go are all layout, which only a real browser has.

afterEach(cleanup);

const FIGURE_SPACE = ' ';

const rows = (withValues: boolean): ReadoutRow[] => [
  {
    label: 'Lock margin',
    value: withValues ? <span data-v>locked +47.9°</span> : undefined,
    status: 'success',
  },
  { label: 'Score', value: withValues ? <span data-v>{`${FIGURE_SPACE}0.145`}</span> : undefined },
  { label: 'Error', value: withValues ? <span data-v>12.345</span> : undefined, status: 'danger' },
];

const box = (el: Element) => el.getBoundingClientRect();

test('values sit right-aligned at the edge of the list', () => {
  const { container } = render(
    <div style={{ width: 320 }}>
      <Readout rows={rows(true)} />
    </div>,
  );
  const dl = must(container.querySelector('dl'));
  const values = [...container.querySelectorAll('[data-v]')];
  expect(values).toHaveLength(3);
  for (const v of values) expect(Math.abs(box(v).right - box(dl).right)).toBeLessThan(0.5);
  expect(box(values[0]).width).not.toBeCloseTo(box(values[2]).width, 0);
});

test('figures are equal width, so padding lines a column up on the decimal point', async () => {
  // 1 and 8 differ in width wherever digits are proportional, as they are in
  // the theme's display face, which has no tabular figures to switch on.
  const { container } = render(
    <div style={{ width: 320, fontFamily: 'var(--wzl-font-display)' }}>
      <Readout
        rows={[
          { label: 'a', value: <span data-v>{`${FIGURE_SPACE}1.111`}</span> },
          { label: 'b', value: <span data-v>88.888</span> },
        ]}
      />
    </div>,
  );
  await document.fonts.ready;
  const [narrow, wide] = [...container.querySelectorAll('[data-v]')];
  expect(Math.abs(box(narrow).width - box(wide).width)).toBeLessThan(0.5);
});

test('the value column holds a minimum width in a shrink-wrapped readout', () => {
  const { container } = render(
    <div style={{ width: 'max-content' }}>
      <Readout rows={[{ label: 'n', value: <span data-v>1</span> }]} />
    </div>,
  );
  const digit = box(must(container.querySelector('[data-v]'))).width;
  const dd = box(must(container.querySelector('dd'))).width;
  expect(dd).toBeGreaterThanOrEqual(8 * digit - 0.5);
});

test('rows keep their place and the list its height while values are absent', () => {
  const { container, rerender } = render(
    <div style={{ width: 320 }}>
      <Readout rows={rows(true)} />
    </div>,
  );
  const dl = () => must(container.querySelector('dl'));
  const rowHeights = () => [...dl().children].map((r) => box(r).height);
  const withValues = { list: box(dl()).height, rows: rowHeights() };
  rerender(
    <div style={{ width: 320 }}>
      <Readout rows={rows(false)} />
    </div>,
  );
  expect(dl().querySelectorAll('[data-empty]')).toHaveLength(3);
  expect(box(dl()).height).toBeCloseTo(withValues.list, 1);
  expect(rowHeights()).toEqual(withValues.rows);
});

test('a status dot is drawn before its value, on the same line', () => {
  const { container } = render(
    <div style={{ width: 320 }}>
      <Readout rows={rows(true)} />
    </div>,
  );
  const dd = must(container.querySelector('dd'));
  const dot = box(must(dd.querySelector('[aria-hidden]')));
  const value = box(must(dd.querySelector('[data-v]')));
  expect(dot.width).toBeGreaterThan(0);
  expect(dot.right).toBeLessThanOrEqual(value.left);
  expect(dot.top).toBeGreaterThanOrEqual(value.top - 1);
  expect(dot.bottom).toBeLessThanOrEqual(value.bottom + 1);
});

test('a text row wraps inside a figures readout instead of overflowing it', () => {
  const { container } = render(
    <div style={{ width: 300, fontFamily: 'var(--wzl-font-display)' }}>
      <Readout
        rows={[
          { label: 'Score', value: <span data-v>0.145</span> },
          {
            label: 'Sides',
            value: (
              <span data-t>
                1 flat, 2 tab, 3 blank, 4 blank, 5 flat, 6 tab, 7 blank, 8 blank, 9 flat
              </span>
            ),
            values: 'text',
          },
        ]}
      />
    </div>,
  );
  const dl = must(container.querySelector('dl'));
  expect(dl.scrollWidth).toBeLessThanOrEqual(dl.clientWidth);
  const text = must(container.querySelector('[data-t]'));
  expect(box(text).right).toBeLessThanOrEqual(box(dl).right + 0.5);
  expect(box(text).height).toBeGreaterThan(
    box(must(container.querySelector('[data-v]'))).height * 1.5,
  );
  expect(
    Math.abs(box(must(container.querySelector('[data-v]'))).right - box(dl).right),
  ).toBeLessThan(0.5);
});
