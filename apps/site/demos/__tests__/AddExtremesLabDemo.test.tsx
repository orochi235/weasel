import { cleanup } from '@testing-library/react';
import { countPathAnchors, type Path } from '@weasel-js/core';
import { giveKeys } from '@weasel-js/react/testing/giveKeys';
import { renderSettled } from '@weasel-js/react/testing/renderSettled';
import { StrictMode } from 'react';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { AddExtremesLabDemo } from '../AddExtremesLabDemo';
import { click, press, sceneCanvas, stubResizeObserver } from './pathEditLabHarness';

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
    const { container } = await renderSettled(<StrictMode><AddExtremesLabDemo /></StrictMode>);
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
});
