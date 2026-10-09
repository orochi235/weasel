import '@weasel-js/theme/tokens.css';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeAll, expect, test } from 'vitest';
import { ListEditor } from '../ListEditor';
import { PropertyField } from './PropertyField';
import { PropertyList, PropertyRow } from './PropertyPanel';

// Where an inline row puts its label is a layout question, so only a real
// browser can answer it.

afterEach(cleanup);

beforeAll(() => {
  const style = document.createElement('style');
  // A label track narrow enough that a long name wraps inside it.
  style.textContent = [
    '.narrow-labels { --wzl-params-label-width: 70px; width: 260px; }',
    // Label size and body size far enough apart that a value set in the wrong one shows.
    '.split-sizes { --wzl-font-size-sm: 13px; --wzl-font-size: 18px; width: 260px; }',
  ].join('\n');
  document.head.append(style);
});

const box = (el: Element) => el.getBoundingClientRect();
const mid = (r: DOMRect) => r.top + r.height / 2;
/** The row a control sits in: the nearest ancestor holding a row label. */
const rowOf = (control: Element) => {
  let el: Element | null = control;
  while (el && !el.querySelector(':scope > [class*="rowLabel"]')) el = el.parentElement;
  if (!el) throw new Error('no row');
  return el;
};
const labelOf = (control: Element) => rowOf(control).querySelector(':scope > [class*="rowLabel"]')!;

/**
 * Where an element's first text sits, from a zero-height inline box set beside it. The box goes in a span wrapped
 * round the text: appended to a flex container it would be a flex item, off the line.
 */
const baselineOf = (el: Element) => {
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, (n) =>
    n.textContent?.trim() ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP,
  );
  const text = walker.nextNode()!;
  const wrap = document.createElement('span');
  const probe = document.createElement('span');
  probe.style.display = 'inline-block';
  text.parentNode!.replaceChild(wrap, text);
  wrap.append(text, probe);
  const y = probe.getBoundingClientRect().bottom;
  wrap.replaceWith(text);
  return y;
};

/** Settles the ResizeObserver a row measures itself with. */
const frames = () =>
  new Promise<void>((done) => requestAnimationFrame(() => requestAnimationFrame(() => done())));

test('a one-line row keeps its label centered on the control', async () => {
  render(
    <PropertyList align="center" className="narrow-labels">
      <PropertyField kind="number" label="Size" value={4} onChange={() => {}} layout="inline" />
    </PropertyList>,
  );
  await frames();
  const field = screen.getByRole('spinbutton', { name: 'Size' });
  const row = rowOf(field);
  expect(row.hasAttribute('data-multiline')).toBe(false);
  expect(Math.abs(mid(box(labelOf(field))) - mid(box(row)))).toBeLessThan(1.5);
});

test('beside a textarea, the label sits at the top even under align="center"', async () => {
  render(
    <PropertyList align="center" className="narrow-labels">
      <PropertyField
        kind="string"
        control="textarea"
        label="Notes"
        value={'one\ntwo\nthree\nfour'}
        onChange={() => {}}
        layout="inline"
      />
    </PropertyList>,
  );
  await frames();
  const area = screen.getByRole('textbox', { name: 'Notes' });
  const label = box(labelOf(area));
  const control = box(area);
  expect(control.height).toBeGreaterThan(label.height * 2);
  // Level with the first line of text, not halfway down the box.
  expect(label.top - control.top).toBeGreaterThanOrEqual(0);
  expect(label.top - control.top).toBeLessThan(8);
});

test('beside a list editor, the label sits at the top', async () => {
  render(
    <PropertyList align="center" className="narrow-labels">
      <PropertyRow label="Tags" layout="inline" group>
        <ListEditor aria-label="Tags" value={['a', 'b', 'c', 'd']} onChange={() => {}} />
      </PropertyRow>
    </PropertyList>,
  );
  await frames();
  const editor = screen.getByRole('group', { name: 'Tags' });
  const label = box(labelOf(editor));
  const control = box(editor);
  expect(control.height).toBeGreaterThan(label.height * 2);
  expect(label.top - control.top).toBeLessThan(12);
});

test('a label that wraps puts its first line level with a one-line control', async () => {
  render(
    <PropertyList align="center" className="narrow-labels">
      <PropertyField
        kind="number"
        label="Silhouette outline width"
        value={4}
        onChange={() => {}}
        layout="inline"
      />
    </PropertyList>,
  );
  await frames();
  const field = screen.getByRole('spinbutton', { name: 'Silhouette outline width' });
  const row = rowOf(field);
  const label = box(labelOf(field));
  const control = box(field.parentElement!.closest('[class*="numberField"]') ?? field);
  expect(row.hasAttribute('data-multiline')).toBe(true);
  expect(label.height).toBeGreaterThan(control.height);
  // The label's first line is centered on the field, as a one-line label is;
  // centered as a whole, the field would sit halfway down the two lines.
  const line = Number.parseFloat(getComputedStyle(labelOf(field)).lineHeight);
  expect(Math.abs(label.top + line / 2 - mid(control))).toBeLessThan(2);
});

test('a dropdown row sets its value at the label size, on the label baseline', async () => {
  render(
    <PropertyList className="split-sizes">
      <PropertyField
        kind="enum"
        label="Mode"
        value="a"
        options={[{ value: 'a', label: 'Alpha' }]}
        onChange={() => {}}
        layout="inline"
      />
    </PropertyList>,
  );
  await frames();
  const trigger = screen.getByRole('button', { name: /Mode/ });
  const label = labelOf(trigger);
  const value = [...trigger.querySelectorAll('span')].find((el) => el.textContent === 'Alpha')!;
  expect(getComputedStyle(value).fontSize).toBe('13px');
  expect(getComputedStyle(label).fontSize).toBe('13px');
  expect(Math.abs(baselineOf(value) - baselineOf(label))).toBeLessThan(0.5);
});
