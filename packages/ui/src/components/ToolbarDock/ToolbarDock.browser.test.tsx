import '@weasel-js/theme/tokens.css';
import { cleanup, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, beforeEach, expect, test } from 'vitest';
import { commands, page, userEvent } from 'vitest/browser';
import { BarLayout, type BarOrientation } from '../Bar';
import { ToolbarDock } from './ToolbarDock';
import type { DockBar, DockSpec, ToolbarLayout } from './layout';
import s from './ToolbarDock.browser.test.module.css';
import { renderWithIcons } from '../../testing/withIcons';

let presses: string[] = [];
let layouts: ToolbarLayout[] = [];

const docks: DockSpec[] = [{ id: 'top', edge: 'top' }];

const bar = (id: string, label: string, float = false, extra: Partial<DockBar> = {}): DockBar => ({
  id,
  label,
  docks: ['top'],
  float,
  ...extra,
  render: (orientation: BarOrientation) => (
    <BarLayout
      label={label}
      lead="label"
      orientation={orientation}
      framed
      nodes={[{ kind: 'cell', path: `${id}.go`, content: <button type="button" onClick={() => presses.push(id)}>{`${label} go`}</button> }]}
      cells={() => []}
      row={() => null}
    />
  ),
});
const bars = [bar('file', 'File'), bar('view', 'View'), bar('shape', 'Shape')];
const floaters = [bar('file', 'File', true), bar('view', 'View', true), bar('shape', 'Shape', true)];
const STACKED: ToolbarLayout = { docks: { top: [['file', 'view'], ['shape']] }, floating: {} };

function Host({ offered = bars, initial = STACKED, at = docks }: { offered?: DockBar[]; initial?: ToolbarLayout; at?: DockSpec[] }) {
  const [layout, setLayout] = useState<ToolbarLayout>(initial);
  return (
    <div className={s.frame}>
      <ToolbarDock
        docks={at}
        bars={offered}
        layout={layout}
        movable
        onLayoutChange={(next) => {
          layouts.push(next);
          setLayout(next);
        }}
      />
    </div>
  );
}

type Pt = { x: number; y: number };
const mid = (el: Element): Pt => {
  const r = el.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
};
const to = (p: Pt) => ({ to: [p.x, p.y] as [number, number] });
/** `n` steps from `a` to `b`, so the drag passes its threshold as a hand would rather than in one jump. */
const line = (a: Pt, b: Pt, n = 12): Pt[] => Array.from({ length: n + 1 }, (_, i) => ({ x: a.x + ((b.x - a.x) * i) / n, y: a.y + ((b.y - a.y) * i) / n }));
const handle = (label: string) => screen.getByRole('button', { name: `Move ${label} toolbar` });
const rowIds = () => Array.from(document.querySelectorAll('[data-dock-row]'), (row) => Array.from(row.querySelectorAll(':scope > [data-dock-bar]'), (el) => el.getAttribute('data-dock-bar')));
/** A point just inside the far end of Shape's bar, in the second row. */
const pastShape = (): Pt => {
  const r = document.querySelector('[data-dock-bar="shape"]')!.getBoundingClientRect();
  return { x: r.right - 4, y: r.top + r.height / 2 };
};

beforeEach(async () => {
  presses = [];
  layouts = [];
  await page.viewport(800, 600);
});
afterEach(async () => {
  await commands.pointer([{ up: true }, { to: [790, 590] }]);
  cleanup();
});

test('dragging a real handle moves the bar to another row once, and a button on it still clicks once', async () => {
  render(<Host />);
  const path = line(mid(handle('File')), pastShape());
  await commands.pointer([to(path[0]!), { down: true }, ...path.slice(1).map(to), { up: true }]);
  expect(layouts).toHaveLength(1);
  expect(layouts[0]!.docks.top).toEqual([['view'], ['shape', 'file']]);
  expect(rowIds()).toEqual([['view'], ['shape', 'file']]);
  expect(presses).toEqual([]);
  expect(document.querySelector('[data-dock-dragging], [data-dock-drop]')).toBeNull();

  const go = screen.getByRole('button', { name: 'File go' });
  await commands.pointer([to(mid(go)), { down: true }, { up: true }]);
  expect(presses).toEqual(['file']);
});

test('Escape mid-drag puts the layout back, and the release moves nothing', async () => {
  render(<Host />);
  const path = line(mid(handle('File')), pastShape());
  await commands.pointer([to(path[0]!), { down: true }, ...path.slice(1).map(to)]);
  expect(document.querySelector('[data-dock-bar="file"]')).toHaveAttribute('data-dock-dragging');
  expect(document.querySelector('[data-dock-bar="shape"]')).toHaveAttribute('data-dock-drop', 'after');
  await userEvent.keyboard('{Escape}');
  expect(document.querySelector('[data-dock-dragging], [data-dock-drop]')).toBeNull();
  await commands.pointer([{ up: true }]);
  expect(layouts).toEqual([]);
  expect(rowIds()).toEqual([['file', 'view'], ['shape']]);
  expect(presses).toEqual([]);
});

const floatingBar = (id: string) => document.querySelector(`[data-dock-floating][data-dock-bar="${id}"]`);
const layer = () => document.querySelector('[data-dock-layer]')!.getBoundingClientRect();

test('a bar torn off its dock floats where it is let go, keeping where it was held, and its buttons still click', async () => {
  render(<Host offered={floaters} />);
  const grab = mid(handle('File'));
  const box = document.querySelector('[data-dock-bar="file"]')!.getBoundingClientRect();
  const drop = { x: layer().left + 300, y: layer().top + 200 };
  await commands.pointer([to(grab), { down: true }, ...line(grab, drop).slice(1).map(to), { up: true }]);
  expect(layouts).toHaveLength(1);
  expect(layouts[0]!.docks.top).toEqual([['view'], ['shape']]);
  expect(layouts[0]!.floating.file).toMatchObject({ anchor: null, orientation: 'horizontal' });
  const placed = floatingBar('file')!.getBoundingClientRect();
  expect(placed.left - box.left).toBeCloseTo(drop.x - grab.x, 0);
  expect(placed.top - box.top).toBeCloseTo(drop.y - grab.y, 0);
  expect(presses).toEqual([]);

  const go = screen.getByRole('button', { name: 'File go' });
  await commands.pointer([to(mid(go)), { down: true }, { up: true }]);
  expect(presses).toEqual(['file']);
  expect(layouts).toHaveLength(1);
  window.scrollTo(0, 5000);
  expect(window.scrollY).toBe(0);
});

test('a torn-off bar let go past a corner is caught by it, one inset in', async () => {
  render(<Host offered={floaters} />);
  const grab = mid(handle('File'));
  const past = { x: layer().right + 40, y: layer().bottom + 40 };
  await commands.pointer([to(grab), { down: true }, ...line(grab, past).slice(1).map(to), { up: true }]);
  expect(layouts[0]!.floating.file).toMatchObject({ anchor: 'bottom-right' });
  const placed = floatingBar('file')!.getBoundingClientRect();
  expect(layer().right - placed.right).toBeCloseTo(12, 0);
  expect(layer().bottom - placed.bottom).toBeCloseTo(12, 0);
});

test('a floating bar dropped on a dock row docks there once', async () => {
  const afloat: ToolbarLayout = { docks: { top: [['view'], ['shape']] }, floating: { file: { x: 300, y: 200, anchor: null, orientation: 'horizontal' } } };
  render(<Host offered={floaters} initial={afloat} />);
  const path = line(mid(handle('File')), pastShape());
  await commands.pointer([to(path[0]!), { down: true }, ...path.slice(1).map(to)]);
  expect(document.querySelector('[data-dock-bar="shape"]')).toHaveAttribute('data-dock-drop', 'after');
  await commands.pointer([{ up: true }]);
  expect(layouts).toHaveLength(1);
  expect(layouts[0]).toEqual({ docks: { top: [['view'], ['shape', 'file']] }, floating: {} });
  expect(floatingBar('file')).toBeNull();
  expect(rowIds()).toEqual([['view'], ['shape', 'file']]);
});

test('a vertical bar runs down a left dock, a bar that may not is refused there, and the vertical one runs flat again in the top dock', async () => {
  const sides: DockSpec[] = [{ id: 'top', edge: 'top' }, { id: 'left', edge: 'left' }];
  const offered = [bar('file', 'File', false, { docks: ['top', 'left'] }), bar('tools', 'Tools', false, { docks: ['top', 'left'], vertical: true })];
  render(<Host at={sides} offered={offered} initial={{ docks: { top: [['file']], left: [['tools']] }, floating: {} }} />);
  const tools = screen.getByRole('toolbar', { name: 'Tools' });
  expect(tools).toHaveAttribute('aria-orientation', 'vertical');
  // A column: the button runs on under the lead rather than beside it.
  const go = screen.getByRole('button', { name: 'Tools go' }).getBoundingClientRect();
  expect(go.top).toBeGreaterThanOrEqual(handle('Tools').getBoundingClientRect().bottom);

  const onTools = line(mid(handle('File')), mid(tools));
  await commands.pointer([to(onTools[0]!), { down: true }, ...onTools.slice(1).map(to)]);
  expect(document.querySelector('[data-dock="left"]')).toHaveAttribute('data-dock-unavailable');
  expect(document.querySelector('[data-dock-drop]')).toBeNull();
  await commands.pointer([{ up: true }]);
  expect(layouts).toEqual([]);

  const file = document.querySelector('[data-dock-bar="file"]')!.getBoundingClientRect();
  const pastFile = line(mid(handle('Tools')), { x: file.right - 4, y: file.top + file.height / 2 });
  await commands.pointer([to(pastFile[0]!), { down: true }, ...pastFile.slice(1).map(to), { up: true }]);
  expect(layouts).toEqual([{ docks: { top: [['file', 'tools']], left: [] }, floating: {} }]);
  expect(screen.getByRole('toolbar', { name: 'Tools' })).toHaveAttribute('aria-orientation', 'horizontal');
});

/** A bar of `count` buttons that opens what does not fit from a menu, as draw's bars do. */
const menuBar = (id: string, label: string, count: number): DockBar => ({
  id,
  label,
  docks: ['top'],
  render: (orientation: BarOrientation) => (
    <BarLayout
      label={label}
      lead="label"
      orientation={orientation}
      framed
      overflow="menu"
      nodes={Array.from({ length: count }, (_, i) => ({ kind: 'cell' as const, path: `${id}.${i}`, content: <button type="button">{`${label} ${i}`}</button> }))}
      cells={() => []}
      row={() => null}
    />
  ),
});

test('in a squeezed row, a short bar keeps its only item and the long bars give up theirs', async () => {
  const offered = [menuBar('pick', 'Pick', 1), menuBar('file', 'File', 6), menuBar('view', 'View', 6)];
  renderWithIcons(
    <div className={`${s.frame} ${s.narrow}`}>
      <ToolbarDock docks={docks} bars={offered} layout={{ docks: { top: [['pick', 'file', 'view']] }, floating: {} }} movable />
    </div>,
  );
  // A bar re-measures on its next resize notice, so the row settles over a few frames.
  await expect.poll(() => screen.queryAllByRole('button', { name: 'More' }).length).toBe(2);
  await expect.poll(() => screen.queryByRole('button', { name: 'Pick 0' })).not.toBeNull();
  const pick = screen.getByRole('toolbar', { name: 'Pick' });
  const slot = document.querySelector('[data-dock-bar="pick"]')!.getBoundingClientRect();
  const item = screen.getByRole('button', { name: 'Pick 0' }).getBoundingClientRect();
  expect(pick.querySelector('[data-bar-more]')).toBeNull();
  expect(item.right).toBeLessThanOrEqual(slot.right + 0.5);
  expect(pick.getBoundingClientRect().right).toBeLessThanOrEqual(slot.right + 0.5);
  for (const name of ['File', 'View']) expect(screen.getByRole('toolbar', { name }).querySelector('[data-bar-more]')).not.toBeNull();
  const row = document.querySelector('[data-dock-row]')!;
  expect(row.scrollWidth).toBeLessThanOrEqual(row.clientWidth);
});
