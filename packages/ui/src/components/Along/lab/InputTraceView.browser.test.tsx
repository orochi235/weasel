import '@weasel-js/theme/tokens.css';
import '@weasel-js/theme/fonts.css';
import { cleanup, screen } from '@testing-library/react';
import { afterEach, expect, test } from 'vitest';
import { page, userEvent } from 'vitest/browser';
import { renderWithIcons } from '../../../testing/withIcons';
import { InputTraceView, type InputTraceConfig } from './InputTraceView';

afterEach(cleanup);

const CONFIG: InputTraceConfig = { actions: 10, overflow: 'scroll', slider: true, log: { pointer: true, moves: false, wheel: true, focus: true, keys: true } };

const frame = () => new Promise((r) => requestAnimationFrame(r));
const settle = async () => {
  for (let i = 0; i < 8; i++) await frame();
  await new Promise((r) => setTimeout(r, 10));
  await frame();
};

async function mount(config: InputTraceConfig = CONFIG) {
  await page.viewport(1200, 900);
  renderWithIcons(<InputTraceView config={config} />);
  await document.fonts.ready;
  await settle();
}

/** The log, oldest first: each line's type, target, and whether it was claimed. */
const logged = () =>
  [...document.querySelectorAll<HTMLElement>('[data-event-log] > li')].reverse().map((li) => ({
    type: li.dataset.event!,
    target: li.children[2]!.textContent!,
    claimed: li.hasAttribute('data-claimed'),
  }));
const stops = () => [...document.querySelectorAll<HTMLElement>('[data-tab-stop]')];

test('a wheel on the overflowing bar is logged on the item it landed on, claimed by the bar', async () => {
  await mount();
  const undo = screen.getByRole('button', { name: 'Undo' });
  undo.dispatchEvent(new WheelEvent('wheel', { bubbles: true, cancelable: true, deltaY: 30 }));
  await settle();
  expect(logged()).toContainEqual({ type: 'wheel', target: 'button "Undo"', claimed: true });
});

test('with the run fitting, the same wheel is logged unclaimed: the bar leaves it to the page', async () => {
  await mount({ ...CONFIG, actions: 2 });
  screen.getByRole('button', { name: 'Undo' }).dispatchEvent(new WheelEvent('wheel', { bubbles: true, cancelable: true, deltaY: 30 }));
  await settle();
  expect(logged()).toContainEqual({ type: 'wheel', target: 'button "Undo"', claimed: false });
});

test('a press on the slider band is logged on the band, then the focus it gives the thumb', async () => {
  await mount();
  const tick = document.querySelectorAll<HTMLElement>('[data-slider-tick]')[3]!;
  const r = tick.getBoundingClientRect();
  const p = { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  const band = document.elementFromPoint(p.x, p.y)!;
  const init = { bubbles: true, pointerId: 1, pointerType: 'mouse', isPrimary: true, button: 0, buttons: 1, clientX: p.x, clientY: p.y };
  band.dispatchEvent(new PointerEvent('pointerdown', init));
  document.dispatchEvent(new PointerEvent('pointerup', { ...init, buttons: 0 }));
  await settle();
  const log = logged();
  const down = log.findIndex((l) => l.type === 'pointerdown');
  expect(log[down]?.target).toBe('slider band');
  expect(log.slice(down).some((l) => l.type === 'focusin' && l.target === 'slider "Zoom"')).toBe(true);
});

test('Tab steps through the stops in the order the lab lists them, each focus logged and marked', async () => {
  await mount();
  const names = stops().map((li) => li.textContent);
  expect(names[0]).toBe('button "Before"');
  expect(names.at(-1)).toBe('button "After"');
  expect(names).toContain('slider "Zoom"');
  screen.getByRole('button', { name: 'Before' }).focus();
  await settle();
  const visited = ['button "Before"'];
  for (let i = 1; i < names.length; i++) {
    await userEvent.keyboard('{Tab}');
    await settle();
    const focused = stops().findIndex((li) => li.hasAttribute('data-focused'));
    expect(focused, `Tab ${i}`).toBe(i);
    visited.push(logged().filter((l) => l.type === 'focusin').at(-1)!.target);
  }
  expect(visited).toEqual(names);
  expect(logged().filter((l) => l.type === 'keydown').length).toBe(names.length - 1);
});
