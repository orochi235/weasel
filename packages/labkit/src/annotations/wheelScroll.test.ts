import { afterEach, expect, it } from 'vitest';
import { scrollUnder } from './wheelScroll';

afterEach(() => {
  document.body.replaceChildren();
  Reflect.deleteProperty(document, 'elementsFromPoint');
});

/** An element jsdom believes scrolls: it lays nothing out, so the sizes are stated, and it computes no longhand from
 *  the `overflow` shorthand, so those are stated too. */
function scroller(overflow: string, size: { client: number; scroll: number }): HTMLDivElement {
  const el = document.createElement('div');
  el.style.overflowX = overflow;
  el.style.overflowY = overflow;
  Object.defineProperty(el, 'clientHeight', { value: size.client });
  Object.defineProperty(el, 'scrollHeight', { value: size.scroll });
  Object.defineProperty(el, 'clientWidth', { value: size.client });
  Object.defineProperty(el, 'scrollWidth', { value: size.scroll });
  return el;
}

function setup() {
  const target = document.createElement('div');
  const scroll = scroller('auto', { client: 100, scroll: 400 });
  target.append(scroll);
  const box = document.createElement('div');
  document.body.append(target, box);
  return { target, scroll, box };
}

it('scrolls the scroller under the pointer by the wheel delta', () => {
  const { target, scroll, box } = setup();
  document.elementsFromPoint = () => [box, scroll, target, document.body];
  expect(scrollUnder(new WheelEvent('wheel', { deltaY: 30 }), box, target)).toBe(true);
  expect(scroll.scrollTop).toBe(30);
});

it('converts lines to pixels, and turns shift+vertical into sideways', () => {
  const { target, scroll, box } = setup();
  document.elementsFromPoint = () => [box, scroll];
  scrollUnder(new WheelEvent('wheel', { deltaY: 2, deltaMode: 1 }), box, target);
  expect(scroll.scrollTop).toBe(80);
  scrollUnder(new WheelEvent('wheel', { deltaY: 10, shiftKey: true }), box, target);
  expect(scroll.scrollLeft).toBe(10);
});

it('leaves a scroller at its end alone and reports nothing scrolled', () => {
  const { target, scroll, box } = setup();
  document.elementsFromPoint = () => [box, scroll];
  expect(scrollUnder(new WheelEvent('wheel', { deltaY: -30 }), box, target)).toBe(false);
  expect(scroll.scrollTop).toBe(0);
});

it('ignores an element under the pointer that is outside the target', () => {
  const { target, scroll, box } = setup();
  const outside = scroller('auto', { client: 100, scroll: 400 });
  document.body.append(outside);
  document.elementsFromPoint = () => [box, outside, scroll];
  scrollUnder(new WheelEvent('wheel', { deltaY: 30 }), box, target);
  expect(outside.scrollTop).toBe(0);
  expect(scroll.scrollTop).toBe(30);
});

it('finds the scroller by its box when hit testing skips the target, as it does one with pointer-events: none', () => {
  const { target, scroll, box } = setup();
  const rect = (el: Element, r: { left: number; top: number; right: number; bottom: number }) =>
    Object.defineProperty(el, 'getBoundingClientRect', {
      value: () => ({
        ...r,
        x: r.left,
        y: r.top,
        width: r.right - r.left,
        height: r.bottom - r.top,
      }),
    });
  rect(target, { left: 0, top: 0, right: 200, bottom: 200 });
  rect(scroll, { left: 0, top: 0, right: 200, bottom: 100 });
  document.elementsFromPoint = () => [box, document.body];
  expect(
    scrollUnder(new WheelEvent('wheel', { deltaY: 30, clientX: 50, clientY: 50 }), box, target),
  ).toBe(true);
  expect(scroll.scrollTop).toBe(30);
  expect(
    scrollUnder(new WheelEvent('wheel', { deltaY: 30, clientX: 50, clientY: 150 }), box, target),
  ).toBe(false);
  expect(scroll.scrollTop).toBe(30);
});
