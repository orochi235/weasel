import '@weasel-js/theme/tokens.css';
import { cleanup, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, expect, test, vi } from 'vitest';
import { userEvent } from 'vitest/browser';
import { PageTabs } from './PageTabs';

afterEach(cleanup);

function Strip({ onSelect }: { onSelect: (id: string) => void }) {
  const [pages, setPages] = useState([{ id: 'a', name: 'One' }, { id: 'b', name: 'Two' }, { id: 'c', name: 'Three' }]);
  const [current, setCurrent] = useState('a');
  return (
    <div style={{ width: 600 }}>
      <PageTabs
        pages={pages}
        current={current}
        onSelect={(id) => { onSelect(id); setCurrent(id); }}
        onRename={(id, name) => setPages((ps) => ps.map((p) => (p.id === id ? { ...p, name } : p)))}
        onMove={(id, index) => setPages((ps) => {
          const next = ps.filter((p) => p.id !== id);
          next.splice(index, 0, ps.find((p) => p.id === id)!);
          return next;
        })}
        onAdd={() => {}}
      />
    </div>
  );
}

const labels = () => screen.getAllByRole('tab').map((t) => t.textContent);

test('a click on a tab selects it once and lights it, and a later click on the lit tab selects it again', async () => {
  const onSelect = vi.fn();
  render(<Strip onSelect={onSelect} />);
  await userEvent.click(screen.getByRole('tab', { name: 'Two' }));
  expect(onSelect.mock.calls).toEqual([['b']]);
  expect(screen.getByRole('tab', { name: 'Two' }).getAttribute('aria-selected')).toBe('true');
  // Any sooner and the second click is a double press, which renames.
  await new Promise((r) => setTimeout(r, 600));
  await userEvent.click(screen.getByRole('tab', { name: 'Two' }));
  expect(onSelect.mock.calls).toEqual([['b'], ['b']]);
});

test('a double-click renames in place, and the field keeps focus to be typed in', async () => {
  render(<Strip onSelect={() => {}} />);
  await userEvent.dblClick(screen.getByRole('tab', { name: 'Three' }));
  const field = screen.getByLabelText('Page name');
  expect(document.activeElement).toBe(field);
  await userEvent.keyboard('{ControlOrMeta>}a{/ControlOrMeta}Last{Enter}');
  expect(labels()).toEqual(['One', 'Two', 'Last']);
});

test('dragging a tab past another reorders the strip', async () => {
  render(<Strip onSelect={() => {}} />);
  const one = screen.getByRole('tab', { name: 'One' }).getBoundingClientRect();
  const three = screen.getByRole('tab', { name: 'Three' }).getBoundingClientRect();
  const el = screen.getByRole('tab', { name: 'One' });
  const at = (x: number) => ({ bubbles: true, cancelable: true, pointerId: 1, pointerType: 'mouse', isPrimary: true, clientX: x, clientY: one.top + one.height / 2 });
  el.dispatchEvent(new PointerEvent('pointerdown', { ...at(one.left + 4), button: 0, buttons: 1 }));
  for (const x of [one.left + 30, three.left + 10, three.right - 4]) {
    el.dispatchEvent(new PointerEvent('pointermove', { ...at(x), buttons: 1 }));
    await new Promise((r) => requestAnimationFrame(r));
  }
  el.dispatchEvent(new PointerEvent('pointerup', { ...at(three.right - 4), button: 0, buttons: 0 }));
  await expect.poll(labels).toEqual(['Two', 'Three', 'One']);
});

test('Alt+Right moves the focused tab one place, rather than moving focus', async () => {
  render(<Strip onSelect={() => {}} />);
  screen.getByRole('tab', { name: 'One' }).focus();
  await userEvent.keyboard('{Alt>}{ArrowRight}{/Alt}');
  await expect.poll(labels).toEqual(['Two', 'One', 'Three']);
});

test('the strip is one bar-high row, its tabs filling it, with the + beside them', () => {
  render(<Strip onSelect={() => {}} />);
  const tabs = screen.getAllByRole('tab').map((t) => t.getBoundingClientRect());
  const add = screen.getByRole('button', { name: 'Add page' }).getBoundingClientRect();
  const strip = screen.getByRole('tablist').parentElement!.parentElement!.getBoundingClientRect();
  expect(new Set(tabs.map((r) => Math.round(r.top))).size).toBe(1);
  expect(strip.height).toBe(Number.parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--wzl-tb-height')));
  // The strip's top border is the only part of it a tab does not cover.
  expect(tabs[0]!.height).toBeCloseTo(strip.height - 1, 0);
  expect(add.left).toBeGreaterThanOrEqual(tabs[2]!.right - 1);
});
