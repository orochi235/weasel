import { act, cleanup, render } from '@testing-library/react';
import { useRef } from 'react';
import { afterEach, expect, test, vi } from 'vitest';
import { useNearViewport } from './useNearViewport';

// jsdom has no layout; the browser test covers real clipping and scrolling.

type Entry = { isIntersecting: boolean; rootBounds: DOMRectReadOnly | null; boundingClientRect: DOMRectReadOnly };
let report: (entries: Entry[]) => void = () => {};

const rect = (top: number, bottom: number) => ({ top, bottom, left: 0, right: 100 }) as DOMRectReadOnly;
const ROOT = rect(0, 600);

function stubObserver() {
  vi.stubGlobal(
    'IntersectionObserver',
    class {
      constructor(cb: (entries: Entry[]) => void) { report = cb; }
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
}

function Probe({ initial }: { initial?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const near = useNearViewport(ref, '50%', initial);
  return <div ref={ref} data-near={String(near)} />;
}

const near = () => document.querySelector('[data-near]')?.getAttribute('data-near');

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

test('answers true where the browser has no IntersectionObserver', () => {
  vi.stubGlobal('IntersectionObserver', undefined);
  render(<Probe initial={false} />);
  expect(near()).toBe('true');
});

test('holds `initial` until the observer first reports', () => {
  stubObserver();
  render(<Probe initial={false} />);
  expect(near()).toBe('false');
  act(() => report([{ isIntersecting: true, rootBounds: ROOT, boundingClientRect: rect(10, 90) }]));
  expect(near()).toBe('true');
});

test('counts an element inside the root as near even when a clip hides all of it', () => {
  stubObserver();
  render(<Probe initial={false} />);
  act(() => report([{ isIntersecting: false, rootBounds: ROOT, boundingClientRect: rect(10, 90) }]));
  expect(near()).toBe('true');
});

test('turns false again once the element leaves the root', () => {
  stubObserver();
  render(<Probe />);
  act(() => report([{ isIntersecting: true, rootBounds: ROOT, boundingClientRect: rect(10, 90) }]));
  act(() => report([{ isIntersecting: false, rootBounds: ROOT, boundingClientRect: rect(2000, 2080) }]));
  expect(near()).toBe('false');
});
