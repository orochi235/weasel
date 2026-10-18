import './canvas-kit-demo.css';
import { afterEach, expect, test } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { DemoFrame } from './DemoFrame';
import { PanZoomDemo } from './demos/PanZoomDemo';

// A stage holds a filling canvas at the demo's natural size, which is what the
// visual baselines capture, and a drag on the frame's corner grows the canvas.

let root: Root | null = null;
let host: HTMLDivElement | null = null;
afterEach(() => {
  act(() => root?.unmount());
  host?.remove();
  root = null;
  host = null;
});

const frame = () => new Promise<void>((r) => requestAnimationFrame(() => r()));
const settle = async () => { for (let i = 0; i < 4; i++) await frame(); };

const fire = (el: Element, type: string, x: number, y: number) =>
  el.dispatchEvent(new PointerEvent(type, {
    bubbles: true, cancelable: true, pointerId: 1, pointerType: 'mouse', isPrimary: true,
    button: 0, buttons: type === 'pointerup' ? 0 : 1, clientX: x, clientY: y,
  }));

test('a staged demo opens at its natural size and follows a drag of the corner', async () => {
  host = document.createElement('div');
  host.className = 'ckd-canvas-wrap';
  document.body.append(host);
  await act(async () => {
    root = createRoot(host!);
    root.render(<DemoFrame><PanZoomDemo /></DemoFrame>);
  });
  await settle();
  const canvas = host.querySelector('canvas')!;
  const dpr = window.devicePixelRatio;
  expect([canvas.getBoundingClientRect().width, canvas.getBoundingClientRect().height]).toEqual([400, 300]);
  expect([canvas.width, canvas.height]).toEqual([400 * dpr, 300 * dpr]);

  const corner = host.querySelector('.ckd-demo-resize[data-axis="both"]')!;
  const { left, top } = corner.getBoundingClientRect();
  await act(async () => {
    fire(corner, 'pointerdown', left + 5, top + 5);
    fire(corner, 'pointermove', left + 105, top + 45);
    fire(corner, 'pointerup', left + 105, top + 45);
  });
  await settle();
  expect([canvas.getBoundingClientRect().width, canvas.getBoundingClientRect().height]).toEqual([500, 340]);
  expect([canvas.width, canvas.height]).toEqual([500 * dpr, 340 * dpr]);

  await act(async () => { corner.dispatchEvent(new MouseEvent('dblclick', { bubbles: true })); });
  await settle();
  expect([canvas.width, canvas.height]).toEqual([400 * dpr, 300 * dpr]);
});
