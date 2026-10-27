/**
 * A stack in a frame that the embedding page shows enlarged — a lens's copy of an isolated story — backs its canvases
 * at the density it is shown at, as a stack under a scaled ancestor in its own document does.
 */
import { cleanup, render, waitFor } from '@testing-library/react';
import { afterEach, expect, test } from 'vitest';
import { CanvasStack } from './CanvasStack';

afterEach(() => {
  cleanup();
  document.body.replaceChildren();
});

const LAYERS = [{ id: 'a', visible: true, render: () => {} }];
const VIEW = { zoom: 1, pan: { x: 0, y: 0 } };

/** A box of 100 × 50 CSS px under a wrapper scaled by `scale`: in this document, or in a frame inside the wrapper. */
function mountScaled(scale: number, inFrame: boolean) {
  const wrap = document.createElement('div');
  wrap.style.cssText = `position: absolute; left: 0; top: 0; transform-origin: 0 0; transform: scale(${scale})`;
  document.body.append(wrap);
  let doc = document;
  let frame: HTMLIFrameElement | null = null;
  if (inFrame) {
    frame = document.createElement('iframe');
    frame.style.cssText = 'display: block; width: 200px; height: 100px; border: 0';
    wrap.append(frame);
    doc = frame.contentDocument!;
    doc.body.style.margin = '0';
  }
  const host = doc.createElement('div');
  host.style.cssText = 'width: 100px; height: 50px';
  (inFrame ? doc.body : wrap).append(host);
  render(<CanvasStack layers={LAYERS} view={VIEW} onViewChange={() => {}} />, { container: host });
  const canvas = () => doc.querySelector('canvas')!;
  return { wrap, frame, canvas };
}

/** The canvas's backing width against the device px it covers on the top-level page. */
function backingAgainstShown(canvas: HTMLCanvasElement, frame: HTMLIFrameElement | null) {
  const frameScale = frame ? frame.getBoundingClientRect().width / frame.offsetWidth : 1;
  return { backing: canvas.width, shown: canvas.getBoundingClientRect().width * frameScale * devicePixelRatio };
}

function expectSharpNow(canvas: HTMLCanvasElement, frame: HTMLIFrameElement | null) {
  const { backing, shown } = backingAgainstShown(canvas, frame);
  expect(canvas.style.width).toBe('100px');
  expect(backing).toBeCloseTo(shown, 0);
}

/** Waits for the stack to settle at the backing the page shows it at. */
async function expectSharp(canvas: () => HTMLCanvasElement, frame: HTMLIFrameElement | null) {
  await waitFor(() => expectSharpNow(canvas(), frame));
}

// Checked before anything awaits, so before the size observer first reports: the first pass is already right.
test('a stack under a scaled ancestor in its own document is backed at the density it is shown at', async () => {
  const m = mountScaled(3, false);
  expectSharpNow(m.canvas(), null);
  await expectSharp(m.canvas, null);
});

test('a stack in a frame the page shows at 3x is backed at 3x, not enlarged', async () => {
  const m = mountScaled(3, true);
  expectSharpNow(m.canvas(), m.frame);
  await expectSharp(m.canvas, m.frame);
});

test("a frame's stack measures again on its window's resize, after the page changes the scale", async () => {
  const m = mountScaled(3, true);
  await expectSharp(m.canvas, m.frame);
  m.wrap.style.transform = 'scale(2)';
  m.frame!.contentWindow!.dispatchEvent(new Event('resize'));
  await expectSharp(m.canvas, m.frame);
});
