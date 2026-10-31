import { cleanup, screen, within } from '@testing-library/react';
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
  it('runs Resample from its button, then reruns it in place from the last-operation panel', async () => {
    const { getByRole } = await renderSettled(<StrictMode><ResampleLabDemo /></StrictMode>, { wrapper: withIcons });
    expect(anchors()).toBe(6);
    expect(screen.queryByRole('region', { name: 'Resample' })).toBeNull();
    await userEvent.click(getByRole('button', { name: 'Resample' }));
    const panel = within(screen.getByRole('region', { name: 'Resample' }));
    const count = panel.getByRole('spinbutton', { name: 'Anchors' });
    await userEvent.clear(count);
    await userEvent.type(count, '12{Enter}');
    // 12 asked for, and more where a piece had to be halved to hold tolerance.
    const twelve = anchors();
    expect(twelve).toBeGreaterThanOrEqual(12);
    await userEvent.clear(count);
    await userEvent.type(count, '24{Enter}');
    expect(anchors()).toBeGreaterThanOrEqual(24);
    // Rerun from the original path, not from the 24: the same result as the first time at 12.
    await userEvent.clear(count);
    await userEvent.type(count, '12{Enter}');
    expect(anchors()).toBe(twelve);
  });
});
