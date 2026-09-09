// apps/site/demos/__tests__/SceneScrollerDemo.test.tsx
import { describe, it, expect, afterEach, beforeAll, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { Profiler } from 'react';
import type { View } from '@weasel-js/core';
import { makeGLRecorder } from 'renderer/test-utils/glRecorder';
import { SceneScrollerDemo } from '../SceneScrollerDemo';
import { WORLD } from '../platformer/worldLevel';
import { tileNodes } from '../platformer/sceneWorld';
import { CAM_SCALE } from '../platformer/camera';

// The callouts layer is the demo's own window onto the camera: the canvas
// hands it the view it is painting with. Wrapping it counts paints and
// captures those views without touching the demo.
const paintedViews: View[] = [];

vi.mock('../platformer/skin', async (importOriginal) => {
  const real = await importOriginal<typeof import('../platformer/skin')>();
  return {
    ...real,
    drawCallouts: (...args: Parameters<typeof real.drawCallouts>) => {
      paintedViews.push(args[1]);
      return real.drawCallouts(...args);
    },
  };
});

// Without a context that answers like WebGL2 the paint bails before any layer
// draws, and `paintedViews` would stay empty for the wrong reason.
beforeAll(() => {
  const recorder = makeGLRecorder();
  const proto = HTMLCanvasElement.prototype as unknown as {
    getContext: (...args: unknown[]) => unknown;
  };
  const original = proto.getContext;
  proto.getContext = vi.fn((kind: unknown) => (kind === 'webgl2' ? recorder.gl : null));
  return () => { proto.getContext = original; };
});

afterEach(() => {
  vi.useRealTimers();
  paintedViews.length = 0;
});

// jsdom drives rAF off a setInterval, so faking intervals puts the frame clock
// and the demo's 200 ms stats readout on one virtual clock.
const virtualFrame = () => act(async () => {
  const painted = new Promise((r) => requestAnimationFrame(() => r(null)));
  await vi.advanceTimersByTimeAsync(1000 / 60);
  await painted;
});

describe('SceneScrollerDemo', () => {
  it('mounts without throwing', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    render(<SceneScrollerDemo />);
    expect(screen.getByRole('button', { name: /click to start/i })).toBeTruthy();
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it('builds the level out of scene nodes rather than draw commands', () => {
    // The point of the demo: the world is in the tree, not in a layer closure.
    expect(tileNodes(WORLD).length).toBeGreaterThan(100);
  });

  it('runs frames without throwing', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    render(<SceneScrollerDemo />);
    for (let i = 0; i < 5; i++) {
      await act(async () => {
        await new Promise((r) => requestAnimationFrame(() => r(null)));
      });
    }
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it('starts the run when the canvas takes focus, but not the toolbar', () => {
    const { container } = render(<SceneScrollerDemo />);
    const toggle = () => screen.getByRole('button', { name: /^click to (start|pause)$/i });
    expect(toggle().textContent).toBe('click to start');

    fireEvent.focus(toggle());
    expect(toggle().textContent).toBe('click to start');

    const canvas = container.querySelector('canvas');
    expect(canvas).toBeTruthy();
    fireEvent.focus(canvas!);
    expect(toggle().textContent).toBe('click to pause');
  });

  it('advances the camera without re-rendering the demo', async () => {
    // On a real clock the seven frames below can outlast the demo's 200 ms
    // stats readout, whose commit then lands on this count.
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
    let commits = 0;
    render(
      <Profiler id="scroller" onRender={() => { commits++; }}>
        <SceneScrollerDemo />
      </Profiler>,
    );
    await virtualFrame();
    const before = commits;
    const paintsBefore = paintedViews.length;

    // Six simulated frames.
    for (let i = 0; i < 6; i++) await virtualFrame();

    // Guard: the loop really ran and really painted, six times, with the
    // demo's camera rather than the identity view.
    expect(paintedViews.length - paintsBefore).toBeGreaterThanOrEqual(6);
    expect(paintedViews.at(-1)!.scale).toEqual({ x: CAM_SCALE, y: CAM_SCALE });

    expect(commits).toBe(before);
  });
});
