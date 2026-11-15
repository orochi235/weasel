// apps/site/demos/__tests__/SceneScrollerDemo.test.tsx
import { describe, it, expect, afterEach, beforeAll, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { Profiler } from 'react';
import type { View } from '@weasel-js/core';
import { createGLRecorder } from '@weasel-js/renderer/testing/glRecorder';
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

// The demo keeps its scene to itself; capture it to read the history.
const scenes: { historyEntries(): readonly unknown[] }[] = [];

vi.mock('@weasel-js/core', async (importOriginal) => {
  const real = await importOriginal<typeof import('@weasel-js/core')>();
  return {
    ...real,
    useScene: ((...args: Parameters<typeof real.useScene>) => {
      const scene = real.useScene(...args);
      scenes.push(scene);
      return scene;
    }) as typeof real.useScene,
  };
});

// Without a context that answers like WebGL2 the paint bails before any layer
// draws, and `paintedViews` would stay empty for the wrong reason.
beforeAll(() => {
  const recorder = createGLRecorder();
  const proto = HTMLCanvasElement.prototype as unknown as {
    getContext: (...args: unknown[]) => unknown;
  };
  const original = proto.getContext;
  proto.getContext = vi.fn((kind: unknown) => (kind === 'webgl2' ? recorder.gl : null));
  // The canvas fills its stage, and jsdom measures every box 0×0, which paints nothing.
  const box = vi.spyOn(HTMLCanvasElement.prototype, 'getBoundingClientRect').mockImplementation(
    () => ({ x: 0, y: 0, left: 0, top: 0, right: 720, bottom: 405, width: 720, height: 405, toJSON() {} }) as DOMRect,
  );
  return () => { proto.getContext = original; box.mockRestore(); };
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  paintedViews.length = 0;
  scenes.length = 0;
});

// jsdom stamps a frame with its own wall clock, so on a loaded machine six frames can outlast the
// demo's 200 ms stats readout and its commit lands on a count. These frames run on a virtual clock.
const pending = new Map<number, FrameRequestCallback>();
let frameTime = 0;
let nextHandle = 0;
const runFramesVirtually = () => {
  frameTime = 0;
  pending.clear();
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => (pending.set(++nextHandle, cb), nextHandle));
  vi.stubGlobal('cancelAnimationFrame', (handle: number) => pending.delete(handle));
};
const virtualFrame = () => act(async () => {
  frameTime += 1000 / 60;
  const due = [...pending.values()];
  pending.clear();
  for (const cb of due) cb(frameTime);
});

describe('SceneScrollerDemo', () => {
  it('mounts without throwing', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    render(<SceneScrollerDemo />);
    expect(screen.getByRole('button', { name: /click to start/i })).toBeTruthy();
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it('centers each question mark on its block', () => {
    // A text node aligns inside its pose box, so the mark shares the block's box.
    const nodes = tileNodes(WORLD);
    const marks = nodes.filter((n) => String(n.id).endsWith(':mark'));
    expect(marks.length).toBeGreaterThan(0);
    for (const mark of marks) {
      const block = nodes.find((n) => n.id === String(mark.id).slice(0, -':mark'.length))!;
      expect(mark.pose).toEqual(block.pose);
    }
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

  it('writes its frames without recording history', async () => {
    runFramesVirtually();
    const { container } = render(<SceneScrollerDemo />);
    fireEvent.focus(container.querySelector('canvas')!);
    const paintsBefore = paintedViews.length;
    for (let i = 0; i < 6; i++) await virtualFrame();

    expect(paintedViews.length - paintsBefore).toBeGreaterThanOrEqual(6);
    expect(scenes.at(-1)!.historyEntries()).toHaveLength(0);
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
    runFramesVirtually();
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
