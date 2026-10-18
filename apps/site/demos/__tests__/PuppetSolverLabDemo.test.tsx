import { act, cleanup, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { heldPathWarpOf } from '@weasel-js/path-tools';
import { renderSettled } from '@weasel-js/react/testing/renderSettled';
import { makeGLRecorder } from '@weasel-js/renderer/testing/glRecorder';
import { StrictMode } from 'react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { PuppetSolverLabDemo, SHAPE_ID } from '../PuppetSolverLabDemo';
import { stubResizeObserver } from './pathEditLabHarness';
import { withIcons } from '../../testIcons';

// Without a context that answers like WebGL2 the paint bails before any layer
// draws, and the mesh layer is what reports the counts the panel shows.
beforeAll(() => {
  window.history.replaceState(null, '', '/?test=1');
  stubResizeObserver();
  const recorder = makeGLRecorder();
  const proto = HTMLCanvasElement.prototype as unknown as { getContext: (...args: unknown[]) => unknown };
  const original = proto.getContext;
  proto.getContext = vi.fn((kind: unknown) => (kind === 'webgl2' ? recorder.gl : null));
  const box = vi.spyOn(HTMLCanvasElement.prototype, 'getBoundingClientRect').mockImplementation(
    () => ({ x: 0, y: 0, left: 0, top: 0, right: 800, bottom: 600, width: 800, height: 600, toJSON() {} }) as DOMRect,
  );
  return () => { proto.getContext = original; box.mockRestore(); };
});
afterEach(() => {
  cleanup();
  delete window.__weaselTest;
});

const text = (id: string) => screen.getByTestId(id).textContent;
const frame = () => act(() => new Promise<void>((r) => requestAnimationFrame(() => r())));

/** Paint until the panel shows `id` passing `ok`, or give up after a second's frames. */
async function until(id: string, ok: (v: string | null) => boolean) {
  for (let i = 0; i < 60 && !ok(text(id)); i++) await frame();
  return text(id);
}

const pinsOf = () => {
  const node = window.__weaselTest!.getScene().nodes.find((n) => n.id === SHAPE_ID)!;
  const held = heldPathWarpOf(node.data);
  return held?.warp.kind === 'puppet' ? held.warp.pins : [];
};

describe('PuppetSolverLabDemo', () => {
  it('opens on the squashed disc with a triangle turned over on its outline, and a pin set swaps the shape', async () => {
    await renderSettled(<StrictMode><PuppetSolverLabDemo /></StrictMode>, { wrapper: withIcons });
    expect(Number(await until('inverted', (v) => Number(v) > 0))).toBeGreaterThan(0);
    expect(Number(text('inverted-outline'))).toBeGreaterThan(0);
    const discTriangles = text('triangles');

    await userEvent.click(screen.getByRole('radio', { name: 'Bend' }));
    expect(await until('triangles', (v) => v !== discTriangles && v !== '–')).not.toBe(discTriangles);
    expect(text('inverted')).toBe('0');
    expect(pinsOf()).toHaveLength(3);

    await userEvent.click(screen.getByRole('radio', { name: 'S bar' }));
    expect(Number(await until('inverted', (v) => Number(v) > 0))).toBeGreaterThan(0);
    expect(text('inverted-outline')).toBe('0');
    expect(pinsOf()).toHaveLength(4);
  });

  it('shows no step toggle while the solver keeps its first step to itself', async () => {
    await renderSettled(<StrictMode><PuppetSolverLabDemo /></StrictMode>, { wrapper: withIcons });
    expect(screen.queryByRole('radio', { name: /^Step 1/ })).toBeNull();
    expect(screen.getByRole('radio', { name: 'Wire' })).toBeTruthy();
  });
});
