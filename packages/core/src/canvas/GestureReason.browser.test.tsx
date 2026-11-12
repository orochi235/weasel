/**
 * The reason tag sits beside the pointer on a canvas under a transformed
 * ancestor, which becomes the containing block of the tag's `position: fixed`.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { flushSync } from 'react-dom';
import type { Dispatcher, OngoingOverlay } from '@weasel-js/routing';
import type { View } from 'core/viewport/view';
import { GestureReason } from './GestureReason';

let root: Root | null = null;
let page: HTMLDivElement | null = null;

afterEach(() => {
  root?.unmount();
  page?.remove();
  root = null;
  page = null;
});

function fakeDispatcher(overlays: readonly OngoingOverlay[]): Dispatcher {
  return {
    getInFlightHandles: () => [{ overlay: () => overlays }],
    subscribe: () => () => {},
  } as unknown as Dispatcher;
}

/** The tag's top-left and the pointer's client point, for a reason at world (20, 30) on a canvas under `transform`. */
function shownUnder(transform: string) {
  page = document.createElement('div');
  page.style.cssText = 'position: absolute; left: 0; top: 0; padding: 80px 0 0 120px;';
  const stage = document.createElement('div');
  stage.style.cssText = `transform: ${transform}; transform-origin: 0 0; margin: 40px 0 0 60px; width: 600px; height: 400px;`;
  const canvas = document.createElement('canvas');
  canvas.style.cssText = 'display: block; width: 400px; height: 300px; margin: 30px 0 0 50px;';
  const mount = document.createElement('div');
  stage.append(canvas, mount);
  page.append(stage);
  document.body.append(page);
  const view = { x: 10, y: 0, scale: { x: 2, y: 2 } } as View;
  const overlays: OngoingOverlay[] = [{ kind: 'reason', at: { x: 20, y: 30 }, text: 'Only effects go here' }];
  root = createRoot(mount);
  flushSync(() => {
    root!.render(createElement(GestureReason, { dispatcher: fakeDispatcher(overlays), canvasRef: { current: canvas }, viewRef: { current: view } }));
  });
  const tag = page.querySelector('[role="status"]')!.getBoundingClientRect();
  const c = canvas.getBoundingClientRect();
  const k = c.width / 400;
  // World (20, 30) is screen (20, 60) on the canvas, its camera standing at x 10.
  return { tag, pointer: { x: c.left + 20 * k, y: c.top + 60 * k }, k };
}

describe('GestureReason under a transformed ancestor', () => {
  it.each(['none', 'scale(0.5)', 'translate(17px, 9px) scale(1.5)'])('sits just below and right of the pointer under %s', (transform) => {
    const { tag, pointer, k } = shownUnder(transform);
    expect(tag.left).toBeCloseTo(pointer.x + 14 * k, 0);
    expect(tag.top).toBeCloseTo(pointer.y + 14 * k, 0);
  });
});
