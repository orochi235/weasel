import '@weasel-js/theme/tokens.css';
import '@weasel-js/theme/fonts.css';
import { cleanup, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { PrefGroup, PrefLeaf } from '@weasel-js/prefs';
import { afterEach, beforeAll, expect, it } from 'vitest';
import { Bar } from './Bar';
import { renderWithIcons } from '../../testing/withIcons';

// Which cells a line has room for is layout, and jsdom has none.

// Measured in the kit's own face: without it each OS lays text out in a fallback of its own.
beforeAll(async () => { await document.fonts.load('400 16px Oswald'); });

afterEach(() => {
  cleanup();
  for (const el of document.querySelectorAll('[data-room]')) el.remove();
});

const NAMES = ['Alpha', 'Bravo', 'Charlie', 'Delta', 'Echo', 'Foxtrot'];
const schema: PrefGroup = {
  name: 'Numbers',
  as: 'bar',
  children: Object.fromEntries(
    NAMES.map((name) => [name.toLowerCase(), { kind: 'number', name, description: '', default: 1 } as PrefLeaf]),
  ),
};

/** A block `px` wide for a bar to sit in. */
function room(px: number): HTMLElement {
  const el = document.createElement('div');
  el.setAttribute('data-room', '');
  el.style.width = `${px}px`;
  document.body.append(el);
  return el;
}

const bar = () => screen.getByRole('toolbar', { name: 'Numbers' });
const onLine = () => within(bar()).queryAllByRole('spinbutton').map((el) => el.getAttribute('aria-label'));
const more = () => within(bar()).queryByRole('button', { name: 'More' });

it('keeps the cells its room holds on the line and opens the rest from a button at its end', async () => {
  const el = room(300);
  renderWithIcons(<Bar schema={schema} label="Numbers" overflow="menu" />, { container: el });

  const kept = onLine();
  expect(kept.length).toBeGreaterThan(0);
  expect(kept.length).toBeLessThan(NAMES.length);
  expect(kept).toEqual(NAMES.slice(0, kept.length));
  const edge = el.getBoundingClientRect().right;
  expect(more()!.getBoundingClientRect().right).toBeLessThanOrEqual(edge + 0.5);
  expect(el.scrollWidth).toBeLessThanOrEqual(el.clientWidth);

  await userEvent.click(more()!);
  const menu = await screen.findByRole('dialog', { name: 'More' });
  const opened = within(menu).getAllByRole('spinbutton').map((cell) => cell.getAttribute('aria-label'));
  expect(opened).toEqual(NAMES.slice(kept.length));
  const tops = within(menu).getAllByRole('spinbutton').map((cell) => cell.getBoundingClientRect().top);
  expect(tops).toEqual([...tops].sort((a, b) => a - b));
  expect(new Set(tops).size).toBe(tops.length);
});

it('takes cells back as its room grows, and drops the button once all fit', async () => {
  const el = room(300);
  renderWithIcons(<Bar schema={schema} label="Numbers" overflow="menu" />, { container: el });
  const narrow = onLine().length;

  el.style.width = '460px';
  await expect.poll(() => onLine().length).toBeGreaterThan(narrow);
  expect(more()).not.toBeNull();

  el.style.width = '1400px';
  await expect.poll(onLine).toEqual(NAMES);
  expect(more()).toBeNull();

  el.style.width = '300px';
  await expect.poll(() => onLine().length).toBe(narrow);
});

it('writes an edit made in the menu to the path of the cell', async () => {
  const el = room(300);
  const edits: [string, unknown][] = [];
  renderWithIcons(<Bar schema={schema} label="Numbers" overflow="menu" values={{ foxtrot: 1 }} onChange={(path, value) => edits.push([path, value])} />, { container: el });
  await userEvent.click(more()!);
  const cell = within(await screen.findByRole('dialog', { name: 'More' })).getByRole('spinbutton', { name: 'Foxtrot' });
  await userEvent.clear(cell);
  await userEvent.type(cell, '7{Enter}');
  expect(edits.at(-1)).toEqual(['foxtrot', 7]);
});

it('ends the line on a cell and starts the menu on one where a run is cut', async () => {
  const run = (keys: string[]): PrefGroup => ({
    name: '',
    as: 'section',
    children: Object.fromEntries(keys.map((key) => [key, { kind: 'number', name: key, description: '', default: 1 } as PrefLeaf])),
  });
  const runs: PrefGroup = { name: 'Runs', as: 'bar', children: { a: run(['A1', 'A2']), b: run(['B1', 'B2']), c: run(['C1', 'C2']) } };
  const el = room(1400);
  renderWithIcons(<Bar schema={runs} label="Numbers" overflow="menu" />, { container: el });
  expect(within(bar()).getAllByRole('separator')).toHaveLength(2);

  const seen = new Set<number>();
  for (let px = 60; px <= 520; px += 20) {
    el.style.width = `${px}px`;
    await new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)));
    if (more() === null) continue;
    seen.add(onLine().length);
    const drawn = [...bar().children].filter((child) => !(child as HTMLElement).hidden);
    expect(drawn.at(-2)?.getAttribute('role')).not.toBe('separator');
    expect(drawn[0]?.getAttribute('role')).not.toBe('separator');
  }
  expect(seen.has(2)).toBe(true);
  expect(seen.has(4)).toBe(true);

  el.style.width = '200px';
  await expect.poll(() => onLine().length).toBe(2);
  await userEvent.click(more()!);
  const menu = await screen.findByRole('dialog', { name: 'More' });
  expect(menu.firstElementChild?.getAttribute('role')).not.toBe('separator');
});

it('scrolls with every cell on the line unless asked for the menu', () => {
  const el = room(300);
  renderWithIcons(<Bar schema={schema} label="Numbers" framed />, { container: el });
  expect(onLine()).toEqual(NAMES);
  expect(more()).toBeNull();
  expect(bar().scrollWidth).toBeGreaterThan(bar().clientWidth);
});

it('in a row sized to its content, takes the length that holds every cell, and opens the menu only once squeezed', async () => {
  const el = room(1400);
  el.style.display = 'flex';
  const host = document.createElement('div');
  host.style.display = 'flex';
  host.style.minWidth = '0';
  el.append(host);
  renderWithIcons(<Bar schema={schema} label="Numbers" overflow="menu" />, { container: host });
  await expect.poll(onLine).toEqual(NAMES);
  expect(more()).toBeNull();
  const natural = Number.parseFloat(bar().style.getPropertyValue('--bar-natural'));
  expect(bar().getBoundingClientRect().width).toBeCloseTo(natural, 0);
  expect(host.getBoundingClientRect().width).toBeLessThan(1400);

  el.style.width = '300px';
  await expect.poll(() => more()).not.toBeNull();
  expect(onLine().length).toBeLessThan(NAMES.length);

  el.style.width = '1400px';
  await expect.poll(onLine).toEqual(NAMES);
  expect(more()).toBeNull();
});
