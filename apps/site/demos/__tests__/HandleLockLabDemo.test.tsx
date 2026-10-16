import { act, cleanup, screen } from '@testing-library/react';
import { renderSettled } from '@weasel-js/react/testing/renderSettled';
import { StrictMode } from 'react';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { HandleLockLabDemo } from '../HandleLockLabDemo';
import { drag, installLabEnvironment, labAnchors, sceneCanvas } from './pathLabHarness';

beforeAll(installLabEnvironment);
afterEach(() => {
  cleanup();
  delete window.__weaselTest;
});

describe('HandleLockLabDemo', () => {
  it('turns a handle without changing its length once the length toggle is pressed', async () => {
    const { container } = await renderSettled(<StrictMode><HandleLockLabDemo /></StrictMode>);
    const toggle = screen.getByRole('button', { name: 'Hold handle length' });
    expect(toggle.getAttribute('aria-pressed')).toBe('false');
    await act(async () => { toggle.click(); });
    expect(toggle.getAttribute('aria-pressed')).toBe('true');
    // The top anchor sits at (240, 80) with its out handle 80 to the right.
    drag(sceneCanvas(container), [320, 80], [240, 280]);
    const handle = labAnchors()[0]!.outHandle!;
    expect(handle.x).toBeCloseTo(240, 3);
    expect(handle.y).toBeCloseTo(160, 3);
  });

  it('moves the handle freely with no lock held', async () => {
    const { container } = await renderSettled(<StrictMode><HandleLockLabDemo /></StrictMode>);
    drag(sceneCanvas(container), [320, 80], [300, 40]);
    const handle = labAnchors()[0]!.outHandle!;
    expect(handle.x).toBeCloseTo(300, 3);
    expect(handle.y).toBeCloseTo(40, 3);
  });
});
