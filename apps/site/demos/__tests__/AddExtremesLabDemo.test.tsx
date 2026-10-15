import { countPathAnchors, type Path } from '@weasel-js/core';
import { giveKeys } from '@weasel-js/react/testing/giveKeys';
import { renderSettled } from '@weasel-js/react/testing/renderSettled';
import { StrictMode } from 'react';
import { describe, expect, it } from 'vitest';
import { AddExtremesLabDemo } from '../AddExtremesLabDemo';
import { press, installLabEnv } from './labEnv';

installLabEnv();

const anchors = () =>
  countPathAnchors((window.__weaselTest!.getScene().nodes.find((n) => n.id === 'blob')!.data as { path: Path }).path);

describe('AddExtremesLabDemo', () => {
  it('adds anchors to the selected segment on Alt+E, then to the rest on Alt+Shift+E', async () => {
    const { container } = await renderSettled(<StrictMode><AddExtremesLabDemo /></StrictMode>);
    giveKeys(container.querySelector('.lk-trial-scene canvas'));
    const before = anchors();
    press('e', 'KeyE', { altKey: true });
    const selected = anchors();
    expect(selected).toBeGreaterThan(before);
    press('E', 'KeyE', { altKey: true, shiftKey: true });
    expect(anchors()).toBeGreaterThan(selected);
  });
});
