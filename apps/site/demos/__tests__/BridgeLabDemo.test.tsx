import { cleanup, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { pathToAnchors, type PolygonPath } from '@weasel-js/core';
import { DEFAULT_BRIDGE_TENSION } from '@weasel-js/path-tools';
import { renderSettled } from '@weasel-js/react/testing/renderSettled';
import { StrictMode } from 'react';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { BridgeLabDemo } from '../BridgeLabDemo';
import { installLabEnvironment } from './pathLabHarness';
import { withIcons } from '../../testIcons';

beforeAll(installLabEnvironment);
afterEach(() => {
  cleanup();
  delete window.__weaselTest;
});

const nodes = () => window.__weaselTest!.getScene().nodes;

describe('BridgeLabDemo', () => {
  it('bridges the two seeded paths into one with a curve leaving each end along its heading', async () => {
    await renderSettled(<StrictMode><BridgeLabDemo /></StrictMode>, { wrapper: withIcons });
    expect(nodes()).toHaveLength(3);

    await userEvent.click(screen.getByRole('button', { name: 'Bridge' }));

    expect(nodes().map((n) => n.id)).toEqual(['arc', 'wire']);
    const [run] = pathToAnchors((nodes()[0].data as { path: PolygonPath }).path).anchors;
    expect(run).toHaveLength(5);
    const [tail, head] = [run[1], run[2]];
    // The arc arrives heading down-right at 45 degrees; the hook leaves heading straight down.
    const gap = Math.hypot(head.x - tail.x, head.y - tail.y);
    const out = { x: tail.outHandle!.x - tail.x, y: tail.outHandle!.y - tail.y };
    const into = { x: head.x - head.inHandle!.x, y: head.y - head.inHandle!.y };
    expect(Math.hypot(out.x, out.y)).toBeCloseTo(DEFAULT_BRIDGE_TENSION * gap, 2);
    expect(out.x).toBeCloseTo(out.y, 2);
    expect(into.x).toBeCloseTo(0, 2);
    expect(into.y).toBeCloseTo(DEFAULT_BRIDGE_TENSION * gap, 2);

    await userEvent.click(screen.getByRole('button', { name: 'Undo' }));
    expect(nodes()).toHaveLength(3);
  });
});
