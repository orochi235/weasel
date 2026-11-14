import '@weasel-js/theme/tokens.css';
import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, test } from 'vitest';
import { pref } from '@weasel-js/prefs';
import { ActionsProvider, useAction, useMenuHost, useMenus, type MenuDef, type MenuHost } from '@weasel-js/core';
import { fixedWidth, measureMenuPanel, MENU_CARET_SIZE, UNBOUNDED, type MenuRowFace } from '@weasel-js/ui-logic';
import { ContextMenuHost } from '@weasel-js/ui/components/ContextMenu';
import { domMeasureEnv } from '@weasel-js/ui';
import { Button, domButton, type ButtonProps } from '@weasel-js/ui/components/Button';
import { domItemList } from '@weasel-js/ui/components/ItemList';
import s from './ItemList/ItemList.module.css';
import menu from './ContextMenu/ContextMenu.module.css';

// The DOM half of the measure/draw contract: CSS lays a button, a list, and a menu panel out from the tokens
// `measure` reads, so what `measure` says must be what the browser draws. Only a real layout engine can say so.

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
    ['an icon alone', { iconOnly: true, 'aria-label': 'Add', children: ICON }],
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
    const slotWidth = (_: unknown, slot: 'leading' | 'trailing') => (slot === 'leading' ? 12 : list.querySelector(`.${s.trailing}:not(:empty)`)!.getBoundingClientRect().width);
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

describe('a DOM menu panel is the box measureMenuPanel gives, as the HUD menu draws it', () => {
  const action = (id: string, label: string) => ({ id, label, invoker: { timing: 'immediate' as const, run: () => {} } });
  const MENUS: MenuDef[] = [{
    id: 'm',
    menu: pref.group('', {
      edit: pref.group('', { cut: pref.action('cut'), all: pref.action('all') }),
      arr: pref.group('Arrange', { forward: pref.action('forward') }, { as: 'menu' }),
    }),
  }];
  let host: MenuHost | null = null;
  function Setup() {
    useAction(action('cut', 'Cut'));
    useAction(action('all', 'Select every shape on the page'));
    useAction(action('forward', 'Forward'));
    useMenus(MENUS);
    host = useMenuHost();
    return <ContextMenuHost />;
  }

  test('rows, separators, labels, and its size', () => {
    render(<ActionsProvider><Setup /></ActionsProvider>);
    act(() => { host!.open({ menu: 'm', client: { x: 20, y: 20 }, source: 'pointer' }); });
    const panel = screen.getByRole('menu');
    const lines = [...panel.children].filter((el) => /^(separator|menuitem)/.test(el.getAttribute('role') ?? ''));
    const face = {
      rows: lines.map((el): MenuRowFace => (el.getAttribute('role') === 'separator' ? { kind: 'separator' } : {
        kind: 'row', label: el.querySelector(`.${menu.label}`)!.textContent!,
        ...(el.getAttribute('aria-haspopup') === 'menu' ? { trailing: MENU_CARET_SIZE } : {}),
      })),
    };
    expect(face.rows.map((r) => r.kind)).toEqual(['row', 'row', 'separator', 'row']);
    const m = measureMenuPanel(face, UNBOUNDED, domMeasureEnv(panel));
    const box = panel.getBoundingClientRect();
    near(box.width, m.width);
    near(box.height, m.height);
    m.layout.rows.forEach((row, i) => {
      const got = boxIn(lines[i]!, panel);
      if (row.kind === 'separator') {
        near(got.x, row.line.x);
        near(got.y, row.line.y);
        near(got.width, row.line.width);
        near(got.height, row.line.height);
        return;
      }
      near(got.y, row.rect.y);
      near(got.height, row.rect.height);
      near(got.x, row.rect.x);
      near(got.width, row.rect.width);
      near(boxIn(lines[i]!.querySelector(`.${menu.label}`)!, panel).x, row.label.x);
      if (row.trailing) near(boxIn(lines[i]!.lastElementChild!, panel).x, row.trailing.x);
    });
  });
});
