import { cleanup } from '@testing-library/react';
import { countPathAnchors, type Path } from '@weasel-js/core';
import { giveKeys } from '@weasel-js/react/testing/giveKeys';
import { renderSettled } from '@weasel-js/react/testing/renderSettled';
import { StrictMode } from 'react';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { AnchorSelectLabDemo } from '../AnchorSelectLabDemo';
import { press, stubResizeObserver } from './pathEditLabHarness';
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

describe('AnchorSelectLabDemo', () => {
  it('opens with every 4th anchor selected, and ] grows the selection along the path', async () => {
    const { container } = await renderSettled(<StrictMode><AnchorSelectLabDemo /></StrictMode>, { wrapper: withIcons });
    giveKeys(container.querySelector('.lk-trial-scene canvas'));
    const before = anchors();
    // Grow takes the 4 seeded anchors to 12; deleting them leaves the other 4.
    press(']', 'BracketRight');
    press('Delete', 'Delete');
    expect(before - anchors()).toBe(12);
  });
});
