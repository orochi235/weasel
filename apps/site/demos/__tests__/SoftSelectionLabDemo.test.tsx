import { cleanup } from '@testing-library/react';
import { renderSettled } from '@weasel-js/react/testing/renderSettled';
import { StrictMode } from 'react';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { SoftSelectionLabDemo } from '../SoftSelectionLabDemo';
import { drag, installLabEnvironment, labAnchors, sceneCanvas } from './pathLabHarness';
import { withIcons } from '../../testIcons';

beforeAll(installLabEnvironment);
afterEach(() => {
  cleanup();
  delete window.__weaselTest;
});

describe('SoftSelectionLabDemo', () => {
  it('drags the neighbors of a dragged anchor part of the way, and leaves the far ones', async () => {
    const { container } = await renderSettled(<StrictMode><SoftSelectionLabDemo /></StrictMode>, { wrapper: withIcons });
    const before = labAnchors();
    // Anchor 2 sits at (180, 160); its neighbors at (120, 260) and (240, 260).
    drag(sceneCanvas(container), [180, 160], [180, 200]);
    const after = labAnchors();
    expect(after[2]!.y).toBeCloseTo(200, 3);
    for (const i of [1, 3]) {
      expect(after[i]!.y).toBeGreaterThan(before[i]!.y + 1);
      expect(after[i]!.y).toBeLessThan(before[i]!.y + 40);
    }
    expect(after[0]).toEqual(before[0]);
    expect(after[8]).toEqual(before[8]);
  });
});
