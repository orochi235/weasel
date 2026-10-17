import { cleanup } from '@testing-library/react';
import { pathInWorld, type Path } from '@weasel-js/core';
import { heldPathWarpOf } from '@weasel-js/path-tools';
import { renderSettled } from '@weasel-js/react/testing/renderSettled';
import { StrictMode } from 'react';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { EnvelopeLabDemo } from '../EnvelopeLabDemo';
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

describe('EnvelopeLabDemo', () => {
  it('bends the banner through a dragged mesh point', async () => {
    const { container } = await renderSettled(<StrictMode><EnvelopeLabDemo /></StrictMode>, { wrapper: withIcons });
    const canvas = sceneCanvas(container);

    // A 3 × 3 mesh over (100, 100)–(400, 280): an inner point sits at (200, 160).
    drag(canvas, [200, 160], [230, 110]);

    const banner = node('banner');
    const held = heldPathWarpOf(banner.data);
    expect(held?.warp.kind).toBe('envelope');
    expect(held?.warp.kind === 'envelope' && held.warp.mesh.points[5]).toEqual({ x: 230, y: 110 });
    // Every bar edge began on a multiple of 20; the second bar's top is pulled
    // up into the gap above it.
    const world = pathInWorld((banner.data as { path: Path }).path, banner.pose as never);
    const ys = Array.from((world as { coords: ArrayLike<number> }).coords).filter((_, i) => i % 2 === 1);
    expect(ys.some((y) => y > 120.5 && y < 139.5)).toBe(true);
  });
});
