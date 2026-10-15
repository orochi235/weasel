import { cleanup } from '@testing-library/react';
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
  it('turns a handle without changing its length while the length lock holds', async () => {
    const { container } = await renderSettled(<StrictMode><HandleLockLabDemo /></StrictMode>);
    // The top anchor sits at (240, 80) with its out handle 80 to the right.
    drag(sceneCanvas(container), [320, 80], [240, 280]);
    const handle = labAnchors()[0]!.outHandle!;
    expect(handle.x).toBeCloseTo(240, 3);
    expect(handle.y).toBeCloseTo(160, 3);
  });
});
