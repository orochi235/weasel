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

const bar = (id: string, label: string): DockBar => ({
  id,
  label,
  docks: ['top'],
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

function Host() {
  const [layout, setLayout] = useState<ToolbarLayout>({ docks: { top: [['file', 'view'], ['shape']] }, floating: {} });
  return (
    <div className={s.frame}>
      <ToolbarDock
        docks={docks}
        bars={bars}
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
