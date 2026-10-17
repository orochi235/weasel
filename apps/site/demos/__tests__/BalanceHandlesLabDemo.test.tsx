import { cleanup } from '@testing-library/react';
import { renderSettled } from '@weasel-js/react/testing/renderSettled';
import { StrictMode } from 'react';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { BalanceHandlesLabDemo } from '../BalanceHandlesLabDemo';
import { doubleClick, drag, editedAnchors, sceneCanvas, stubResizeObserver } from './pathEditLabHarness';
import { withIcons } from '../../testIcons';

beforeAll(() => {
  window.history.replaceState(null, '', '/?test=1');
  stubResizeObserver();
});
afterEach(() => {
  cleanup();
  delete window.__weaselTest;
});

// The first segment runs (100, 320) to (340, 140), with handles at
// (140, 200) and (260, 140): its grip sits midway, at (200, 170), and slides
// out from the chord's middle (220, 230) along (-20, -60) per unit of scale.
const GRIP = [200, 170];

describe('BalanceHandlesLabDemo', () => {
  it('scales both of a segment\'s handles together when its grip is dragged', async () => {
    const { container } = await renderSettled(<StrictMode><BalanceHandlesLabDemo /></StrictMode>, { wrapper: withIcons });
    drag(sceneCanvas(container), GRIP, [190, 140]);

    const [a, b] = editedAnchors();
    expect(a.outHandle!.x).toBeCloseTo(160, 3);
    expect(a.outHandle!.y).toBeCloseTo(140, 3);
    expect(b.inHandle!.x).toBeCloseTo(220, 3);
    expect(b.inHandle!.y).toBeCloseTo(140, 3);
    // The anchors stay put, and so does the next segment's handle.
    expect([a.x, a.y, b.x, b.y]).toEqual([100, 320, 340, 140]);
    expect(b.outHandle).toEqual({ x: 420, y: 140 });
  });

  it('gives a segment\'s handles one proportion when its grip is double-clicked', async () => {
    const { container } = await renderSettled(<StrictMode><BalanceHandlesLabDemo /></StrictMode>, { wrapper: withIcons });
    doubleClick(sceneCanvas(container), GRIP[0], GRIP[1]);

    // Both handle lines run to (160, 140); the handles reach 2/3 and 4/9 of
    // the way there, and meet at 5/9.
    const [a, b] = editedAnchors();
    expect(a.outHandle!.x).toBeCloseTo(100 + (5 / 9) * 60, 2);
    expect(a.outHandle!.y).toBeCloseTo(320 - (5 / 9) * 180, 2);
    expect(b.inHandle!.x).toBeCloseTo(340 - (5 / 9) * 180, 2);
  });
});
