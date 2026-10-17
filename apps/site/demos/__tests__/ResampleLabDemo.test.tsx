import { act, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { pathToAnchors, type PolygonPath } from '@weasel-js/core';
import { renderSettled } from '@weasel-js/react/testing/renderSettled';
import { StrictMode } from 'react';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { ResampleLabDemo } from '../ResampleLabDemo';
import { stubResizeObserver } from './pathEditLabHarness';
import { withIcons } from '../../testIcons';

beforeAll(() => {
  window.history.replaceState(null, '', '/?test=1');
  stubResizeObserver();
});
afterEach(() => {
  cleanup();
  delete window.__weaselTest;
});

const anchors = () =>
  pathToAnchors((window.__weaselTest!.getScene().nodes.find((n) => n.id === 'curve')!.data as { path: PolygonPath }).path)
    .anchors[0].length;

describe('ResampleLabDemo', () => {
  it('opens previewing a resample to 12 anchors, and Apply writes it to the scene', async () => {
    const { getByRole } = await renderSettled(<StrictMode><ResampleLabDemo /></StrictMode>, { wrapper: withIcons });
    expect(anchors()).toBe(6);
    await userEvent.click(getByRole('button', { name: 'Apply' }));
    await act(async () => { await Promise.resolve(); });
    // 12 asked for, and more where a piece had to be halved to hold tolerance.
    expect(anchors()).toBeGreaterThanOrEqual(12);
  });
});
