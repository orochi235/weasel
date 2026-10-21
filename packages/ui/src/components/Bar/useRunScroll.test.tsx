import { afterEach, describe, expect, test } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import type { FocusEvent as ReactFocusEvent, PointerEvent as ReactPointerEvent } from 'react';
import { lineShape, trackRun } from '@weasel-js/geom';
import { runPlaces, type RunSpot } from './runPlaces';
import { useRunScroll } from './useRunScroll';

// Five items 20 long with 15 between run to 160 along a run 100 long; jsdom puts every box at (0, 0).
const run = trackRun(lineShape({ x: 0, y: 0 }, { x: 100, y: 0 }));
const GAP = 15;
const lengths = [20, 20, 20, 20, 20];

function mount(total: number) {
  const root = document.createElement('div');
  for (let i = 0; i < lengths.length; i++) {
    const item = document.createElement('button');
    item.setAttribute('data-bar-item', `k${i}`);
    root.append(item);
  }
  document.body.append(root);
  const ref = { current: root };
  const drawn = { offset: 0 };
  const hook = renderHook(() => {
    const scroll = useRunScroll({ root: ref, run, total, lengths, spots: (): RunSpot[] => runPlaces(lengths, GAP, run.length, 'start', drawn.offset) });
    drawn.offset = scroll.offset;
    return scroll;
  });
  const items = Array.from(root.children) as HTMLElement[];
  return { root, items, hook };
}

const wheel = (root: HTMLElement, deltaY: number): WheelEvent => {
  const e = new WheelEvent('wheel', { deltaY, bubbles: true, cancelable: true });
  act(() => {
    root.dispatchEvent(e);
  });
  return e;
};

const press = (on: HTMLElement, x: number) =>
  ({ target: on, currentTarget: on, button: 0, buttons: 1, pointerId: 1, clientX: x, clientY: 0 }) as unknown as ReactPointerEvent;
const pointer = (type: string, x: number) => new PointerEvent(type, { pointerId: 1, buttons: type === 'pointerup' ? 0 : 1, clientX: x, clientY: 0, bubbles: true });

/** Whether a click dispatched on `el` reaches a listener on it. */
function clickReaches(el: HTMLElement): boolean {
  let reached = false;
  const listen = () => {
    reached = true;
  };
  el.addEventListener('click', listen);
  el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
  el.removeEventListener('click', listen);
  return reached;
}

afterEach(() => {
  document.body.replaceChildren();
});

describe('useRunScroll', () => {
  test('a wheel moves the offset and holds it inside the run', () => {
    const { root, hook } = mount(160);
    const first = wheel(root, 30);
    expect(hook.result.current.offset).toBe(30);
    expect(first.defaultPrevented).toBe(true);
    wheel(root, 100);
    expect(hook.result.current.offset).toBe(60);
  });

  test('a press that does not travel is a press, not a scroll', () => {
    const { items, hook } = mount(160);
    act(() => {
      hook.result.current.onPointerDownCapture(press(items[1]!, 50));
      document.dispatchEvent(pointer('pointermove', 52));
      document.dispatchEvent(pointer('pointerup', 52));
    });
    expect(hook.result.current.offset).toBe(0);
    expect(clickReaches(items[1]!)).toBe(true);
  });

  test('a drag along the run past the slop scrolls it and swallows the click', () => {
    const { items, hook } = mount(160);
    act(() => {
      hook.result.current.onPointerDownCapture(press(items[1]!, 50));
      document.dispatchEvent(pointer('pointermove', 30));
    });
    expect(hook.result.current.offset).toBe(20);
    act(() => {
      document.dispatchEvent(pointer('pointerup', 30));
    });
    expect(clickReaches(items[1]!)).toBe(false);
  });

  test('a drag that carries on past the end of the run keeps scrolling it', () => {
    const { items, hook } = mount(160);
    act(() => {
      hook.result.current.onPointerDownCapture(press(items[0]!, 20));
      document.dispatchEvent(pointer('pointermove', -20));
    });
    expect(hook.result.current.offset).toBe(40);
  });

  test('focus on an item past the end scrolls it fully into view at that end', () => {
    const { items, hook } = mount(160);
    act(() => {
      hook.result.current.onFocusCapture({ target: items[4]! } as unknown as ReactFocusEvent);
    });
    expect(hook.result.current.offset).toBe(60);
    act(() => {
      hook.result.current.onFocusCapture({ target: items[0]! } as unknown as ReactFocusEvent);
    });
    expect(hook.result.current.offset).toBe(0);
  });

  test('a run that fits never scrolls', () => {
    const { root, items, hook } = mount(80);
    const e = wheel(root, 30);
    expect(hook.result.current.offset).toBe(0);
    expect(e.defaultPrevented).toBe(false);
    act(() => {
      hook.result.current.onPointerDownCapture(press(items[1]!, 50));
      document.dispatchEvent(pointer('pointermove', 30));
      document.dispatchEvent(pointer('pointerup', 30));
    });
    expect(hook.result.current.offset).toBe(0);
    expect(clickReaches(items[1]!)).toBe(true);
  });
});
