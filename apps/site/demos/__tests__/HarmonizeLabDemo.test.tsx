import { act, cleanup, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderSettled } from '@weasel-js/react/testing/renderSettled';
import { StrictMode } from 'react';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { HarmonizeLabDemo } from '../HarmonizeLabDemo';
import { click, editedAnchors, sceneCanvas, stubResizeObserver } from './pathEditLabHarness';

beforeAll(() => {
  window.history.replaceState(null, '', '/?test=1');
  stubResizeObserver();
});
afterEach(() => {
  cleanup();
  delete window.__weaselTest;
});

/** The first anchor's in- and out-handle lengths. */
function firstHandleLengths(): [number, number] {
  const a = editedAnchors()[0];
  return [Math.hypot(a.inHandle!.x - a.x, a.inHandle!.y - a.y), Math.hypot(a.outHandle!.x - a.x, a.outHandle!.y - a.y)];
}

describe('HarmonizeLabDemo', () => {
  it('harmonizes the whole path from the bar, keeping each anchor\'s handles in line, and undoes', async () => {
    await renderSettled(<StrictMode><HarmonizeLabDemo /></StrictMode>);
    const [inBefore, outBefore] = firstHandleLengths();
    expect([inBefore, outBefore]).toEqual([40, 60]);

    await userEvent.click(screen.getByRole('button', { name: 'Harmonize curvature' }));

    const [inAfter, outAfter] = firstHandleLengths();
    expect(Math.abs(inAfter - inBefore)).toBeGreaterThan(1);
    expect(inAfter * outAfter).toBeCloseTo(inBefore * outBefore, 0);
    const a = editedAnchors()[0];
    expect(a.inHandle!.y).toBeCloseTo(100, 3);
    expect(a.outHandle!.y).toBeCloseTo(100, 3);

    await userEvent.click(screen.getByRole('button', { name: 'Undo' }));
    expect(firstHandleLengths()).toEqual([40, 60]);
  });

  it('answers H, the key the lab tunes onto the command, for the selected anchor', async () => {
    const { container } = await renderSettled(<StrictMode><HarmonizeLabDemo /></StrictMode>);
    // A press in the trial is what hands its canvas the keys; this one
    // selects anchor 0.
    click(sceneCanvas(container), 200, 100);
    act(() => {
      document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'h', bubbles: true, cancelable: true }));
    });
    expect(firstHandleLengths()[0]).not.toBeCloseTo(40, 0);
  });
});
