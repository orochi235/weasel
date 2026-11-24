import { afterEach, expect, it, vi } from 'vitest';
import { scrollByWheel } from './scrollByWheel';

function tallRoot(): HTMLElement {
  const root = document.documentElement;
  Object.defineProperty(document, 'scrollingElement', { configurable: true, value: root });
  for (const [k, v] of Object.entries({
    clientHeight: 100,
    scrollHeight: 400,
    clientWidth: 100,
    scrollWidth: 100,
  }))
    Object.defineProperty(root, k, { configurable: true, value: v });
  root.scrollBy = vi.fn();
  return root;
}

afterEach(() => {
  const root = document.documentElement;
  for (const k of ['clientHeight', 'scrollHeight', 'clientWidth', 'scrollWidth', 'scrollBy'])
    delete (root as unknown as Record<string, unknown>)[k];
  delete (document as unknown as Record<string, unknown>).scrollingElement;
  root.style.overflow = '';
  document.body.style.overflow = '';
});

const wheel = () => new WheelEvent('wheel', { deltaY: 40 });

it('scrolls a tall page whose root leaves overflow visible', () => {
  const root = tallRoot();
  expect(scrollByWheel(document.body, wheel())).toBe(true);
  expect(root.scrollBy).toHaveBeenCalledWith({ left: 0, top: 40 });
});

it.each(['hidden', 'clip'])('leaves a page alone whose root is overflow: %s', (overflow) => {
  const root = tallRoot();
  root.style.overflow = overflow;
  expect(scrollByWheel(document.body, wheel())).toBe(false);
  expect(root.scrollBy).not.toHaveBeenCalled();
});

it('leaves a page alone whose body is overflow: hidden under a visible root', () => {
  const root = tallRoot();
  document.body.style.overflow = 'hidden';
  expect(scrollByWheel(document.body, wheel())).toBe(false);
  expect(root.scrollBy).not.toHaveBeenCalled();
});

function scroller(props: Record<string, number>): HTMLElement {
  const el = document.createElement('div');
  for (const [k, v] of Object.entries(props))
    Object.defineProperty(el, k, { configurable: true, writable: true, value: v });
  el.scrollBy = vi.fn();
  document.body.append(el);
  return el;
}

it('passes over a body whose overflow went to the viewport, to the page', () => {
  const root = tallRoot();
  const body = document.body;
  body.style.overflow = 'auto';
  for (const [k, v] of Object.entries({ clientHeight: 100, scrollHeight: 400 }))
    Object.defineProperty(body, k, { configurable: true, value: v });
  body.scrollBy = vi.fn();
  try {
    expect(scrollByWheel(body, wheel())).toBe(true);
    expect(body.scrollBy).not.toHaveBeenCalled();
    expect(root.scrollBy).toHaveBeenCalledWith({ left: 0, top: 40 });
  } finally {
    for (const k of ['clientHeight', 'scrollHeight', 'scrollBy'])
      delete (body as unknown as Record<string, unknown>)[k];
  }
});

