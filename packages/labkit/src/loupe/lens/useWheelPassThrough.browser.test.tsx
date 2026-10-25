import '../../styles.less';
import './useWheelPassThrough.browser.test.less';
import { cleanup, render } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, expect, test } from 'vitest';
import { commands, page } from 'vitest/browser';
import { useWheelPassThrough } from './useWheelPassThrough';

// The wheel handed on is a dispatched copy, and a browser scrolls an element only for a trusted wheel. Whether the
// scroller under a lens moves is a real browser's scrolling, with a real wheel.

afterEach(() => cleanup());

function Harness() {
  const [layer, setLayer] = useState<HTMLElement | null>(null);
  const [input, setInput] = useState<HTMLElement | null>(null);
  useWheelPassThrough(input, layer);
  return (
    <div className="lk-wheel-test-host">
      <div className="lk-wheel-test-outer">
        <div className="lk-wheel-test-inner">
          <div className="lk-wheel-test-tall" />
        </div>
        <div className="lk-wheel-test-tall" />
      </div>
      <div ref={setLayer} className="lk-lens-layer">
        <div ref={setInput} className="lk-lens-input">
          <div className="lk-lens-hit lk-wheel-test-hit" />
        </div>
      </div>
    </div>
  );
}

async function mount(): Promise<{ inner: HTMLElement; outer: HTMLElement; at: [number, number] }> {
  await page.viewport(800, 600);
  render(<Harness />);
  const hit = document.querySelector('.lk-wheel-test-hit') as HTMLElement;
  const box = hit.getBoundingClientRect();
  const at: [number, number] = [box.left + box.width / 2, box.top + box.height / 2];
  // The premise: the wheel lands on the hit box, not on the scroller.
  expect(document.elementFromPoint(...at)).toBe(hit);
  return {
    inner: document.querySelector('.lk-wheel-test-inner') as HTMLElement,
    outer: document.querySelector('.lk-wheel-test-outer') as HTMLElement,
    at,
  };
}

async function settle(): Promise<void> {
  await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
}

test('scrolls the scroller beneath a lens by the wheel', async () => {
  const { inner, outer, at } = await mount();
  await commands.pointer([{ to: at }, { wheel: [0, 120] }]);
  await expect.poll(() => inner.scrollTop).toBe(120);
  await settle();
  expect(outer.scrollTop).toBe(0);
});

test('leaves the scroller where it is when something beneath cancels the wheel', async () => {
  const { inner, outer, at } = await mount();
  let seen = 0;
  inner.addEventListener(
    'wheel',
    (e) => {
      seen++;
      e.preventDefault();
    },
    { passive: false },
  );
  await commands.pointer([{ to: at }, { wheel: [0, 120] }]);
  await expect.poll(() => seen).toBe(1);
  await settle();
  expect(inner.scrollTop).toBe(0);
  expect(outer.scrollTop).toBe(0);
});

test('scrolls the next scroller out once the one beneath can move no further', async () => {
  const { inner, outer, at } = await mount();
  inner.scrollTop = inner.scrollHeight;
  const end = inner.scrollTop;
  await commands.pointer([{ to: at }, { wheel: [0, 120] }]);
  await expect.poll(() => outer.scrollTop).toBe(120);
  expect(inner.scrollTop).toBe(end);
});
