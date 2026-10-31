import '@weasel-js/theme/tokens.css';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, test } from 'vitest';
import { fixedWidth, UNBOUNDED } from '@weasel-js/headless';
import { domMeasureEnv } from '../domMeasureEnv';
import { Button, domButton, type ButtonProps } from './Button';
import { domItemList } from './ItemList';
import s from './ItemList/ItemList.module.css';

// The DOM half of the measure/draw contract: CSS lays a button and a list out from the tokens `measure` reads, so
// what `measure` says must be what the browser draws. Only a real layout engine can say so.

afterEach(cleanup);
beforeAll(async () => { await document.fonts.ready; });

/** `el`'s box relative to `origin`'s. */
const boxIn = (el: Element, origin: Element) => {
  const a = el.getBoundingClientRect(), o = origin.getBoundingClientRect();
  return { x: a.x - o.x, y: a.y - o.y, width: a.width, height: a.height };
};
const near = (got: number, want: number) => expect(Math.abs(got - want)).toBeLessThanOrEqual(1);

const ICON = <svg viewBox="0 0 16 16" data-icon=""><rect width="16" height="16" /></svg>;

describe('a DOM button is the box measureButton gives', () => {
  test.each<[string, ButtonProps]>([
    ['a label', { children: 'Save changes' }],
    ['a small label', { children: 'Save', size: 'sm' }],
    ['icons either side', { children: 'Export', leadingIcon: ICON, trailingIcon: ICON }],
    ['an icon alone', { iconOnly: true, ariaLabel: 'Add', children: ICON }],
    ['a spinner', { children: 'Saving', loading: true }],
  ])('%s', (_, props) => {
    render(<div data-testid="host"><Button {...props} /></div>);
    const button = screen.getByRole('button');
    const m = domButton.measure(props, UNBOUNDED, domMeasureEnv(button));
    const box = button.getBoundingClientRect();
    near(box.width, m.width);
    near(box.height, m.height);
    const slots = [...button.children];
    expect(slots).toHaveLength(m.layout.parts.length);
    m.layout.parts.forEach(({ rect }, i) => {
      const got = boxIn(slots[i]!, button);
      near(got.x, rect.x);
      near(got.width, rect.width);
      near(got.height, rect.height);
    });
  });

  test('a full-width button centers its parts in the width it is given', () => {
    render(<div style={{ width: 300 }}><Button fullWidth>Go</Button></div>);
    const button = screen.getByRole('button');
    const m = domButton.measure({ children: 'Go' }, fixedWidth(300), domMeasureEnv(button));
    near(button.getBoundingClientRect().width, 300);
    near(boxIn(button.firstElementChild!, button).x, m.layout.parts[0]!.rect.x);
  });
});

describe('a DOM item list is the box measureRowList gives', () => {
  const rows = [
    { id: 'a', label: 'Alpha', leading: <span className="swatch" /> },
    { id: 'b', label: 'Bravo, the longest row', trailing: <button type="button">x</button> },
    { id: 'c', label: 'Charlie' },
  ];

  test('rows, their labels, and their slots', () => {
    render(
      <div style={{ width: 240 }}>
        <style>{'.swatch { display: block; width: 12px; height: 12px; flex: none }'}</style>
        <ItemListHost rows={rows} />
      </div>,
    );
    const list = document.querySelector(`.${s.list}`)!;
    const slotWidth = (_: unknown, slot: 'leading' | 'trailing') => (slot === 'leading' ? 12 : list.querySelector(`.${s.trailing}`)!.getBoundingClientRect().width);
    const m = domItemList.measure({ props: { rows }, slotWidth }, fixedWidth(240), domMeasureEnv(list));
    near(list.getBoundingClientRect().height, m.height);
    const rowEls = [...list.querySelectorAll(`.${s.row}`)];
    expect(rowEls).toHaveLength(3);
    m.layout.rows.forEach((box, i) => {
      const row = boxIn(rowEls[i]!, list);
      near(row.y, box.rect.y);
      near(row.height, box.rect.height);
      const label = boxIn(rowEls[i]!.querySelector(`.${s.label}`)!, list);
      near(label.x, box.label.x);
      near(label.width, box.label.width);
    });
  });

  test('the empty state', () => {
    render(<div style={{ width: 240 }}><ItemListHost rows={[]} /></div>);
    const list = document.querySelector(`.${s.list}`)!;
    const m = domItemList.measure({ props: { rows: [] } }, fixedWidth(240), domMeasureEnv(list));
    near(list.getBoundingClientRect().height, m.height);
  });
});

function ItemListHost({ rows }: { rows: Parameters<typeof domItemList.draw>[0]['props']['rows'] }) {
  return domItemList.draw({ props: { rows, onActivate: () => {} } }, {});
}
