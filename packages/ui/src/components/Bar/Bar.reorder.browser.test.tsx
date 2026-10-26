import '@weasel-js/theme/tokens.css';
import { cleanup, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, expect, test } from 'vitest';
import { commands, page, userEvent } from 'vitest/browser';
import { ActionsProvider, type Action } from '@weasel-js/core';
import { arcShape } from '@weasel-js/geom';
import type { PrefGroup, PrefLeaf, PrefOrder } from '@weasel-js/prefs';
import { Bar, type BarProps } from './Bar';
import s from './Bar.reorder.browser.test.module.css';
import { RegisterActions } from '@weasel-js/routing/testing/registerAction';

const KEYS = ['a', 'b', 'c', 'd'] as const;
let presses: string[] = [];
let orders: PrefOrder[] = [];
const ACTIONS: Action[] = [
  ...KEYS.map((key): Action => ({ id: `t.${key}`, label: key.toUpperCase(), invoker: { timing: 'immediate', run: () => presses.push(key) } })),
  ...['front', 'back'].map((id): Action => ({ id, label: id, group: 'arrange', invoker: { timing: 'immediate', run: () => presses.push(id) } })),
];
const act = (key: string): PrefLeaf => ({ kind: 'action', name: key.toUpperCase(), description: '', default: undefined, action: `t.${key}` }) as PrefLeaf;
const FOUR: PrefGroup = { name: 'Tools', children: Object.fromEntries(KEYS.map((key) => [key, act(key)])) };
const ARRANGE: PrefGroup = {
  name: 'Tools',
  children: { a: act('a'), arrange: { kind: 'actions', name: 'Arrange', description: '', default: undefined, group: 'arrange' } as PrefLeaf },
};

const host = (node: ReactNode) => (
  <ActionsProvider>
    <RegisterActions actions={ACTIONS} />
    {node}
  </ActionsProvider>
);

const bar = (props: Partial<BarProps> = {}) => <Bar schema={FOUR} label="Tools" onReorder={(order) => orders.push(order)} {...props} />;

type Pt = { x: number; y: number };
const mid = (el: Element): Pt => {
  const r = el.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
};
const to = (p: Pt) => ({ to: [p.x, p.y] as [number, number] });
const button = (name: string) => screen.getByRole('button', { name });

/** A real mouse dragged through `path` with the platform's command key held the whole way. */
async function modDrag(path: Pt[]) {
  await userEvent.keyboard('{ControlOrMeta>}');
  await commands.pointer([to(path[0]!), { down: true }, ...path.slice(1).map(to), { up: true }]);
  await userEvent.keyboard('{/ControlOrMeta}');
}

/** `n` steps from `a` to `b`, so the drag passes its threshold as a hand would rather than in one jump. */
const line = (a: Pt, b: Pt, n = 12): Pt[] => Array.from({ length: n + 1 }, (_, i) => ({ x: a.x + ((b.x - a.x) * i) / n, y: a.y + ((b.y - a.y) * i) / n }));

beforeEach(async () => {
  presses = [];
  orders = [];
  await page.viewport(800, 600);
});
afterEach(async () => {
  await commands.pointer([{ up: true }, { to: [790, 590] }]);
  cleanup();
});

test('a Cmd-drag along a straight bar reorders it once, and a plain click on the same button runs its action once', async () => {
  render(host(<div className={s.line}>{bar()}</div>));
  const past = mid(button('C'));
  await modDrag(line(mid(button('A')), { x: past.x + 4, y: past.y }));
  expect(orders).toEqual([{ '': ['b', 'c', 'a', 'd'] }]);
  expect(presses).toEqual([]);
  expect(document.querySelector('[data-bar-dragging], [data-bar-drop]')).toBeNull();

  await commands.pointer([to(mid(button('A'))), { down: true }, { up: true }]);
  expect(presses).toEqual(['a']);
});

test('a Cmd-drag along a curved bar reorders it', async () => {
  const shape = arcShape({ center: { x: 120, y: 120 }, radius: 100, start: 290, end: 70 });
  render(host(<div className={s.box}>{bar({ shape })}</div>));
  const box = document.querySelector(`.${s.box}`)!.getBoundingClientRect();
  const c = { x: box.left + 120, y: box.top + 120 };
  const bearing = (p: Pt) => Math.atan2(p.x - c.x, c.y - p.y);
  const onCircle = (rad: number): Pt => ({ x: c.x + 100 * Math.sin(rad), y: c.y - 100 * Math.cos(rad) });
  const from = bearing(mid(button('A')));
  const past = bearing(mid(button('C'))) + (5 * Math.PI) / 180;
  await modDrag(Array.from({ length: 25 }, (_, i) => onCircle(from + ((past - from) * i) / 24)));
  expect(orders).toEqual([{ '': ['b', 'c', 'a', 'd'] }]);
  expect(presses).toEqual([]);
});

test('a marked actions button lays out where an unmarked one does', async () => {
  const boxOf = () => button('front').getBoundingClientRect().toJSON() as DOMRect;
  render(host(<div className={s.line}><Bar schema={ARRANGE} label="Tools" /></div>));
  const bare = boxOf();
  cleanup();
  render(host(<div className={s.line}><Bar schema={ARRANGE} label="Tools" onReorder={() => {}} /></div>));
  expect(document.querySelector('[data-bar-unit="front"]')).not.toBeNull();
  expect(boxOf()).toEqual(bare);
});
