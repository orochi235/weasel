import { countPathAnchors, type Path } from '@weasel-js/core';
import { giveKeys } from '@weasel-js/react/testing/giveKeys';
import { renderSettled } from '@weasel-js/react/testing/renderSettled';
import { StrictMode } from 'react';
import { describe, expect, it } from 'vitest';
import { AnchorSelectLabDemo } from '../AnchorSelectLabDemo';
import { press, installLabEnv } from './labEnv';

installLabEnv();

const anchors = () =>
  countPathAnchors((window.__weaselTest!.getScene().nodes.find((n) => n.id === 'flower')!.data as { path: Path }).path);

describe('AnchorSelectLabDemo', () => {
  it('opens with every 4th anchor selected, and ] grows the selection along the path', async () => {
    const { container } = await renderSettled(<StrictMode><AnchorSelectLabDemo /></StrictMode>);
    giveKeys(container.querySelector('.lk-trial-scene canvas'));
    const before = anchors();
    // Grow takes the 4 seeded anchors to 12; deleting them leaves the other 4.
    press(']', 'BracketRight');
    press('Delete', 'Delete');
    expect(before - anchors()).toBe(12);
  });
});
