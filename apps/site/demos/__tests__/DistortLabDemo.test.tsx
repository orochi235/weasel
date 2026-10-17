import { cleanup, screen } from '@testing-library/react';
import { heldPathWarpOf } from '@weasel-js/path-tools';
import userEvent from '@testing-library/user-event';
import { renderSettled } from '@weasel-js/react/testing/renderSettled';
import { StrictMode } from 'react';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { DistortLabDemo } from '../DistortLabDemo';
import { drag, sceneCanvas, stubResizeObserver } from './pathEditLabHarness';
import { withIcons } from '../../testIcons';

beforeAll(() => {
  window.history.replaceState(null, '', '/?test=1');
  stubResizeObserver();
});
afterEach(() => {
  cleanup();
  delete window.__weaselTest;
});

const node = (id: string) => window.__weaselTest!.getScene().nodes.find((n) => n.id === id)!;

describe('DistortLabDemo', () => {
  it('drags a corner of the selection box and distorts both shapes, which Expand turns to plain paths', async () => {
    const { container } = await renderSettled(<StrictMode><DistortLabDemo /></StrictMode>, { wrapper: withIcons });
    const canvas = sceneCanvas(container);
    const before = node('board').data;

    // The box around the board and the disc runs (80, 80) to (460, 240).
    drag(canvas, [460, 240], [520, 300]);

    for (const id of ['board', 'disc']) {
      const warp = heldPathWarpOf(node(id).data);
      expect(warp?.warp.kind).toBe('distort');
    }
    expect(node('board').data).not.toBe(before);
    expect(node('board').pose).toMatchObject({ x: 80, y: 80 });
    expect((node('board').pose as { width: number }).width).toBeGreaterThan(241);

    // The palette's Expand keeps the geometry and drops the warp.
    const warped = node('board').data as { path: unknown };
    await userEvent.click(screen.getByRole('button', { name: /^Expand warp/ }));
    expect(heldPathWarpOf(node('board').data)).toBeNull();
    expect((node('board').data as { path: unknown }).path).toBe(warped.path);
  });
});
