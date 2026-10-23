import '@weasel-js/theme/tokens.css';
import { cleanup, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, beforeEach, expect, test } from 'vitest';
import { commands, page, userEvent } from 'vitest/browser';
import { BarLayout, type BarOrientation } from '../Bar';
import { ToolbarDock } from './ToolbarDock';
import type { DockBar, DockSpec, ToolbarLayout } from './layout';
import s from './ToolbarDock.browser.test.module.css';

let presses: string[] = [];
let layouts: ToolbarLayout[] = [];

const docks: DockSpec[] = [{ id: 'top', edge: 'top' }];

const bar = (id: string, label: string, float = false): DockBar => ({
  id,
  label,
  docks: ['top'],
  float,
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

function Host({ offered = bars, initial = STACKED }: { offered?: DockBar[]; initial?: ToolbarLayout }) {
  const [layout, setLayout] = useState<ToolbarLayout>(initial);
  return (
    <div className={s.frame}>
      <ToolbarDock
        docks={docks}
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
