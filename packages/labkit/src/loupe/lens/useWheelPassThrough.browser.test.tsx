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

// An isolated story renders in a same-origin frame, which the shell's hit test answers with the frame element itself.
const FRAME_DOC = `<!doctype html><style>
  html, body { margin: 0; height: 100%; overflow: hidden; }
  .scroller { position: absolute; left: 20px; top: 20px; width: 300px; height: 200px; overflow: auto; }
  .tall { height: 2000px; }
</style><div class="scroller"><div class="tall"></div></div>`;

function FrameHarness() {
  const [layer, setLayer] = useState<HTMLElement | null>(null);
  const [input, setInput] = useState<HTMLElement | null>(null);
  useWheelPassThrough(input, layer);
  return (
    <div className="lk-wheel-test-host">
      <div className="lk-wheel-test-outer">
        <iframe className="lk-wheel-test-frame" srcDoc={FRAME_DOC} title="story" />
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

async function mountFrame(): Promise<{
  frame: HTMLIFrameElement;
  scroller: HTMLElement;
  at: [number, number];
}> {
  await page.viewport(800, 600);
  render(<FrameHarness />);
  const frame = document.querySelector('.lk-wheel-test-frame') as HTMLIFrameElement;
  await expect.poll(() => frame.contentDocument?.querySelector('.scroller') ?? null).not.toBeNull();
  const scroller = frame.contentDocument!.querySelector('.scroller') as HTMLElement;
  const hit = document.querySelector('.lk-wheel-test-hit') as HTMLElement;
  const box = hit.getBoundingClientRect();
  const at: [number, number] = [box.left + box.width / 2, box.top + box.height / 2];
  expect(document.elementFromPoint(...at)).toBe(hit);
  return { frame, scroller, at };
}

test("scrolls the scroller beneath a lens inside an isolated story's frame", async () => {
  const { scroller, at } = await mountFrame();
  const outer = document.querySelector('.lk-wheel-test-outer') as HTMLElement;
  await commands.pointer([{ to: at }, { wheel: [0, 120] }]);
  await expect.poll(() => scroller.scrollTop).toBe(120);
  await settle();
  expect(outer.scrollTop).toBe(0);
});

test('scrolls out of the frame once nothing inside it can move', async () => {
  const { scroller, at } = await mountFrame();
  const outer = document.querySelector('.lk-wheel-test-outer') as HTMLElement;
  scroller.scrollTop = scroller.scrollHeight;
  const end = scroller.scrollTop;
  await commands.pointer([{ to: at }, { wheel: [0, 120] }]);
  await expect.poll(() => outer.scrollTop).toBe(120);
  expect(scroller.scrollTop).toBe(end);
});

test('hands the frame a wheel of its own realm, at the point in its own coordinates', async () => {
  const { frame, scroller, at } = await mountFrame();
  const seen: { local: boolean; x: number; y: number }[] = [];
  const view = frame.contentWindow as Window & typeof globalThis;
  scroller.addEventListener('wheel', (e) => {
    seen.push({ local: e instanceof view.WheelEvent, x: e.clientX, y: e.clientY });
  });
  const box = frame.getBoundingClientRect();
  await commands.pointer([{ to: at }, { wheel: [0, 120] }]);
  await expect.poll(() => seen.length).toBe(1);
  expect(seen[0]).toEqual({ local: true, x: at[0] - box.left - 10, y: at[1] - box.top - 10 });
});
