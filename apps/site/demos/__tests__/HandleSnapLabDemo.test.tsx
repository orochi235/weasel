import { cleanup } from '@testing-library/react';
import { renderSettled } from '@weasel-js/react/testing/renderSettled';
import { StrictMode } from 'react';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { HandleSnapLabDemo } from '../HandleSnapLabDemo';
import { drag, installLabEnvironment, labAnchors, sceneCanvas } from './pathLabHarness';

beforeAll(installLabEnvironment);
afterEach(() => {
  cleanup();
  delete window.__weaselTest;
});

describe('HandleSnapLabDemo', () => {
  it('snaps a handle dragged a few degrees off level back onto the level', async () => {
    const { container } = await renderSettled(<StrictMode><HandleSnapLabDemo /></StrictMode>);
    // The top anchor sits at (240, 80) with its out handle at (320, 80).
    drag(sceneCanvas(container), [320, 80], [330, 84]);
    const handle = labAnchors()[0]!.outHandle!;
    expect(handle.y).toBeCloseTo(80, 3);
    expect(handle.x).toBeCloseTo(240 + Math.hypot(90, 4), 3);
  });
});
