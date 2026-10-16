import { cleanup } from '@testing-library/react';
import { heldPathWarpOf, pathInWorld, type Path } from '@weasel-js/core';
import { renderSettled } from '@weasel-js/react/testing/renderSettled';
import { StrictMode } from 'react';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { PuppetLabDemo } from '../PuppetLabDemo';
import { click, drag, sceneCanvas, stubResizeObserver } from './pathEditLabHarness';

beforeAll(() => {
  window.history.replaceState(null, '', '/?test=1');
  stubResizeObserver();
});
afterEach(() => {
  cleanup();
  delete window.__weaselTest;
});

const eel = () => window.__weaselTest!.getScene().nodes.find((n) => n.id === 'eel')!;
const pinsOf = () => {
  const held = heldPathWarpOf(eel().data);
  return held?.warp.kind === 'puppet' ? held.warp.pins : [];
};
const worldCoords = () => Array.from(
  (pathInWorld((eel().data as { path: Path }).path, eel().pose as never) as { coords: ArrayLike<number> }).coords,
);

describe('PuppetLabDemo', () => {
  it('bends the eel by its head pin while the tail pin holds, adds a pin on a click and takes it out on an Alt-click', async () => {
    const { container } = await renderSettled(<StrictMode><PuppetLabDemo /></StrictMode>);
    const canvas = sceneCanvas(container);
    expect(pinsOf()).toHaveLength(3);
    const tail = worldCoords().slice(0, 2);

    drag(canvas, [480, 195], [440, 320]);

    expect(pinsOf()[2].to).toEqual({ x: 440, y: 320 });
    const after = worldCoords();
    // The tail's first anchor, 30px from a pin that did not move, turns a
    // little about it; the head went 130px.
    expect(Math.hypot(after[0] - tail[0], after[1] - tail[1])).toBeLessThan(10);
    expect(after.some((v, i) => i % 2 === 1 && v > 280)).toBe(true);

    click(canvas, 200, 195);
    expect(pinsOf()).toHaveLength(4);
    click(canvas, 200, 195, true);
    expect(pinsOf()).toHaveLength(3);
  });
});
