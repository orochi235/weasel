import type { ViewApi } from '@weasel-js/core';
import { expect, it } from 'vitest';
import { localRectOf } from './OverviewMarks';

/** An element `width` layout px wide, drawn on the page at `rect`. */
function shown(
  rect: { x: number; y: number; width: number; height: number },
  width: number,
  height: number,
) {
  const el = document.createElement('div');
  Object.defineProperty(el, 'offsetWidth', { value: width });
  Object.defineProperty(el, 'offsetHeight', { value: height });
  el.getBoundingClientRect = () => DOMRect.fromRect(rect);
  return el;
}

it("reads a target's rect in the camera's units when an ancestor draws the camera's element at twice its size", () => {
  const host = shown({ x: 100, y: 50, width: 800, height: 600 }, 400, 300);
  const target = shown({ x: 140, y: 70, width: 200, height: 100 }, 100, 50);
  const view = { get: () => ({ x: 0, y: 0, scale: { x: 1, y: 1 } }) } as unknown as ViewApi;
  expect(localRectOf(target, { element: () => host, view })).toEqual({
    x: 20,
    y: 10,
    w: 100,
    h: 50,
  });
});
