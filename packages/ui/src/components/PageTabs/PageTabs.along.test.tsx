import { afterAll, afterEach, beforeAll, describe, expect, test, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { arcShape, trackRun, type Point } from '@weasel-js/geom';
import { Along, arcInBox, type AlongArc } from '../Along';
import { PageTabs, type PageTabsProps } from './PageTabs';
import alongStyles from '../Along/Along.module.css';

// jsdom lays nothing out: an Along is 200 by 200, every other element 40 wide and 20 tall, every box at (0, 0).
const realRect = Element.prototype.getBoundingClientRect;
const realOffset = ['offsetWidth', 'offsetHeight'].map((k) => [k, Object.getOwnPropertyDescriptor(HTMLElement.prototype, k)!] as const);
const isAlong = (el: HTMLElement) => el.classList.contains(alongStyles.along!);
beforeAll(() => {
  Element.prototype.getBoundingClientRect = function box() {
    return { x: 0, y: 0, left: 0, top: 0, right: 200, bottom: 200, width: 200, height: 200, toJSON: () => {} } as DOMRect;
  };
  Object.defineProperty(HTMLElement.prototype, 'offsetWidth', { configurable: true, get(this: HTMLElement) { return isAlong(this) ? 200 : 40; } });
  Object.defineProperty(HTMLElement.prototype, 'offsetHeight', { configurable: true, get(this: HTMLElement) { return isAlong(this) ? 200 : 20; } });
});
afterAll(() => {
  Element.prototype.getBoundingClientRect = realRect;
  for (const [k, d] of realOffset) Object.defineProperty(HTMLElement.prototype, k, d);
});
afterEach(cleanup);

const TOP: AlongArc = { start: 270, end: 90 };
const run = trackRun(arcShape(arcInBox(TOP, { width: 200, height: 200 })));
const PAGES = [{ id: 'a', name: 'Cover' }, { id: 'b' }, { id: 'c' }];

function setup(props: Partial<PageTabsProps<{ id: string; name?: string }>> = {}) {
  const handlers = { onSelect: vi.fn(), onRename: vi.fn(), onMove: vi.fn(), onAdd: vi.fn() };
  render(
    <Along arc={TOP}>
      <PageTabs aria-label="Pages" pages={PAGES} current="a" {...handlers} {...props} />
    </Along>,
  );
  const list = screen.getByRole('tablist');
  list.setPointerCapture = vi.fn();
  list.releasePointerCapture = vi.fn();
  return handlers;
}

const at = (el: Element): Point => {
  const style = (el as HTMLElement).style;
  return { x: Number.parseFloat(style.getPropertyValue('--at-x')), y: Number.parseFloat(style.getPropertyValue('--at-y')) };
};
const along = (el: Element) => run.nearest(at(el)).f * run.length;
const tab = (name: string) => screen.getByRole('tab', { name });
const add = () => screen.getByRole('button', { name: 'Add page' });
/** A client point `d` px along the run: jsdom's boxes all sit at (0, 0), so client and box coordinates agree. */
const client = (d: number) => {
  const { point } = run.at(d / run.length);
  return { clientX: point.x, clientY: point.y };
};

describe('PageTabs along a curve', () => {
  test('lays its tabs along the run, the + button last', () => {
    setup();
    const ds = [...screen.getAllByRole('tab'), add()].map(along);
    expect(ds.every((d, i) => i === 0 || d - ds[i - 1]! > 39)).toBe(true);
    expect(add()).toHaveAttribute('data-run-slot');
  });

  test('a drag measures along the run, marks the landing across it, and reports the new place', () => {
    const { onMove } = setup();
    const from = along(tab('Cover'));
    const past = along(tab('Page 3')) + 15;
    fireEvent.pointerDown(tab('Cover'), { pointerId: 1, button: 0, ...client(from) });
    act(() => {
      fireEvent.pointerMove(document, { pointerId: 1, ...client(from + 30) });
      fireEvent.pointerMove(document, { pointerId: 1, ...client(past) });
    });
    const mark = document.querySelector('[data-tab-drop]');
    expect(mark).not.toBeNull();
    // Stands across the run just past the third tab's end: its middle lies on the run there.
    const [a, b] = [...mark!.getAttribute('d')!.matchAll(/(-?[\d.]+) (-?[\d.]+)/g)].map((m) => ({ x: Number(m[1]), y: Number(m[2]) }));
    expect(run.nearest({ x: (a!.x + b!.x) / 2, y: (a!.y + b!.y) / 2 }).f * run.length).toBeCloseTo(along(tab('Page 3')) + 20, 0);
    fireEvent.pointerUp(document, { pointerId: 1, ...client(past) });
    expect(onMove).toHaveBeenCalledWith('a', 2);
    expect(document.querySelector('[data-tab-drop]')).toBeNull();
  });

  test('a double press still renames, and Alt+arrow still moves', () => {
    const { onRename, onMove } = setup();
    const press = (el: HTMLElement) => {
      fireEvent.pointerDown(el, { pointerId: 1, button: 0, ...client(along(el)) });
      fireEvent.pointerUp(document, { pointerId: 1, button: 0, ...client(along(el)) });
    };
    press(tab('Page 2'));
    press(tab('Page 2'));
    const field = screen.getByLabelText('Page name');
    fireEvent.change(field, { target: { value: 'Body' } });
    fireEvent.keyDown(field, { key: 'Enter' });
    expect(onRename).toHaveBeenCalledWith('b', 'Body');
    fireEvent.keyDown(tab('Page 2'), { key: 'ArrowRight', altKey: true });
    expect(onMove).toHaveBeenLastCalledWith('b', 2);
  });

  test('+ adds a page from its place on the run', () => {
    const { onAdd } = setup();
    fireEvent.click(add());
    expect(onAdd).toHaveBeenCalled();
  });
});
