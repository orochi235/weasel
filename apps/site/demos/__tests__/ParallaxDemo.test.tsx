import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { Scene } from '@weasel-js/core';
import { ParallaxDemo } from '../ParallaxDemo';

const held = vi.hoisted(() => ({ scene: null as Scene<unknown, string, unknown> | null }));
vi.mock('@weasel-js/core', async (importOriginal) => {
  const core = await importOriginal<typeof import('@weasel-js/core')>();
  return {
    ...core,
    useScene: (opts: never) => {
      const scene = core.useScene(opts);
      held.scene = scene as never;
      return scene;
    },
  };
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('ParallaxDemo', () => {
  it('keeps a per-plane zoom toggle made while the intro plays', () => {
    const queued = new Map<number, FrameRequestCallback>();
    let nextId = 1;
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => { queued.set(nextId, cb); return nextId++; });
    vi.stubGlobal('cancelAnimationFrame', (id: number) => { queued.delete(id); });
    let now = 0;
    const step = (ms: number): void => {
      now += ms;
      const due = [...queued.values()];
      queued.clear();
      act(() => { for (const cb of due) cb(now); });
    };
    const trees = () => held.scene!.layers.find((l) => l.id === 'trees')!.parallax!;

    render(<ParallaxDemo />);
    fireEvent.click(screen.getByRole('button', { name: 'play intro' }));
    step(16);
    step(200);
    const mid = trees().anchor!.x;
    expect(mid).toBeLessThan(0);
    act(() => { fireEvent.click(screen.getByRole('checkbox', { name: 'per-plane zoom' })); });
    // The toggle leaves the intro where it was rather than jumping it to its end.
    expect(trees()).toMatchObject({ zoom: 1.5, anchor: { x: mid } });
    step(200);
    expect(trees().zoom).toBe(1.5);
    for (let i = 0; i < 10; i++) step(200);
    expect(trees()).toMatchObject({ zoom: 1.5, anchor: { x: 0 } });
  });
});
