import { act, cleanup, fireEvent, screen, within } from '@testing-library/react';
import { countPathAnchors, type Path } from '@weasel-js/core';
import { giveKeys } from '@weasel-js/react/testing/giveKeys';
import { renderSettled } from '@weasel-js/react/testing/renderSettled';
import { StrictMode } from 'react';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { AddExtremesLabDemo } from '../AddExtremesLabDemo';
import { click, press, sceneCanvas, stubResizeObserver } from './pathEditLabHarness';
import { withIcons } from '../../testIcons';

beforeAll(() => {
  window.history.replaceState(null, '', '/?test=1');
  stubResizeObserver();
});
afterEach(() => {
  cleanup();
  delete window.__weaselTest;
});

const anchors = () => countPathAnchors((window.__weaselTest!.getScene().nodes[0].data as { path: Path }).path);

describe('AddExtremesLabDemo', () => {
  it('adds anchors to the selected segment on Alt+X, then to the rest once the selection is cleared', async () => {
    const { container } = await renderSettled(<StrictMode><AddExtremesLabDemo /></StrictMode>, { wrapper: withIcons });
    giveKeys(container.querySelector('.lk-trial-scene canvas'));
    const before = anchors();
    press('x', 'KeyX', { altKey: true });
    const selected = anchors();
    expect(selected).toBeGreaterThan(before);
    // Inside the blob, away from every anchor: clears the anchor selection.
    click(sceneCanvas(container), 330, 240);
    press('x', 'KeyX', { altKey: true });
    expect(anchors()).toBeGreaterThan(selected);
  });

  it('offers the run in the last-operation panel, and reruns it in place at the turns picked', async () => {
    const { container } = await renderSettled(<StrictMode><AddExtremesLabDemo /></StrictMode>, { wrapper: withIcons });
    giveKeys(container.querySelector('.lk-trial-scene canvas'));
    const before = anchors();
    press('x', 'KeyX', { altKey: true });
    const both = anchors();
    const panel = within(screen.getByRole('region', { name: 'Add extremes' }));
    act(() => { fireEvent.click(panel.getByRole('radio', { name: 'Top and bottom' })); });
    const ys = anchors();
    act(() => { fireEvent.click(panel.getByRole('radio', { name: 'Left and right' })); });
    const xs = anchors();
    expect(ys).toBeLessThan(both);
    expect(xs).toBeLessThan(both);
    expect(ys - before + (xs - before)).toBe(both - before);
    // Back to both: the same count as the first run, so each change replaced the last rather than adding to it.
    act(() => { fireEvent.click(panel.getByRole('radio', { name: 'Both' })); });
    expect(anchors()).toBe(both);
  });
});
