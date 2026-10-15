import { cleanup } from '@testing-library/react';
import { renderSettled } from '@weasel-js/react/testing/renderSettled';
import { StrictMode } from 'react';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { CurvatureCombLabDemo } from '../CurvatureCombLabDemo';
import { drag, editedAnchors, sceneCanvas, stubResizeObserver } from './pathEditLabHarness';

beforeAll(() => {
  window.history.replaceState(null, '', '/?test=1');
  stubResizeObserver();
});
afterEach(() => {
  cleanup();
  delete window.__weaselTest;
});

describe('CurvatureCombLabDemo', () => {
  it('opens with the path in edit, so a handle drags straight away', async () => {
    const { container } = await renderSettled(<StrictMode><CurvatureCombLabDemo /></StrictMode>);
    const canvas = sceneCanvas(container);
    expect(editedAnchors()[1].outHandle).toEqual({ x: 300, y: 120 });

    drag(canvas, [300, 120], [340, 100]);

    const mid = editedAnchors()[1];
    // The handle moved and its anchor did not: an anchor edit, not a move.
    expect(mid.x).toBeCloseTo(260, 3);
    expect(mid.y).toBeCloseTo(120, 3);
    expect(mid.outHandle!.x).toBeCloseTo(340, 3);
    expect(mid.outHandle!.y).toBeCloseTo(100, 3);
  });
});
