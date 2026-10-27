import { cleanup, render } from '@testing-library/react';
import { type CSSProperties, useRef } from 'react';
import { afterEach, expect, test } from 'vitest';
import { page } from 'vitest/browser';
import { useNearViewport } from './useNearViewport';

// Clipping and scroll position are layout, which jsdom does not compute, and its IntersectionObserver is a stub.

afterEach(cleanup);

function Probe({ clip, top }: { clip: boolean; top: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const near = useNearViewport(ref, '50%');
  const box: CSSProperties = { position: 'fixed', left: 20, top, width: 200, height: 100, overflow: 'hidden' };
  return (
    <div style={clip ? { ...box, width: 10 } : box}>
      <div style={{ marginLeft: 50, width: 120, height: 80 }} ref={ref} data-near={String(near)} />
    </div>
  );
}

const near = () => document.querySelector('[data-near]')?.getAttribute('data-near');

function Scroller() {
  const ref = useRef<HTMLDivElement>(null);
  const near = useNearViewport(ref, '50%');
  return (
    <div data-scroller style={{ position: 'fixed', left: 20, top: 40, width: 200, height: 100, overflow: 'auto' }}>
      <div style={{ height: 20_000 }}>
        <div style={{ width: 120, height: 80 }} ref={ref} data-near={String(near)} />
      </div>
    </div>
  );
}

test('an element its scroll container clips away tracks how far that container scrolls it', async () => {
  await page.viewport(800, 600);
  render(<Scroller />);
  await expect.poll(near).toBe('true');
  const scroller = document.querySelector('[data-scroller]') as HTMLElement;
  scroller.scrollTop = 200;
  await new Promise((done) => setTimeout(done, 300));
  expect(near()).toBe('true');
  // Clipped the whole way: the observer reports nothing past the first step out of the container.
  scroller.scrollTop = 5000;
  await expect.poll(near).toBe('false');
  scroller.scrollTop = 200;
  await expect.poll(near).toBe('true');
  scroller.scrollTop = 5000;
  await expect.poll(near).toBe('false');
  scroller.scrollTop = 0;
  await expect.poll(near).toBe('true');
});

test('an element clipped away by an ancestor while on screen still counts as near', async () => {
  await page.viewport(800, 600);
  const { rerender } = render(<Probe clip={false} top="40px" />);
  await expect.poll(near).toBe('true');
  rerender(<Probe clip top="40px" />);
  // Long enough for the observer to report the clip.
  await new Promise((done) => setTimeout(done, 300));
  expect(near()).toBe('true');
});

test('an element past the margin counts as far, and one inside it as near', async () => {
  await page.viewport(800, 600);
  const { rerender } = render(<Probe clip={false} top="40px" />);
  await expect.poll(near).toBe('true');
  rerender(<Probe clip={false} top="2000px" />);
  await expect.poll(near).toBe('false');
  rerender(<Probe clip={false} top="700px" />);
  await expect.poll(near).toBe('true');
});
