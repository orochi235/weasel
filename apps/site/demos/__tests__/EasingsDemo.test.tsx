import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { Scene } from '@weasel-js/core';
import { EasingsDemo } from '../EasingsDemo';

const held = vi.hoisted(() => ({ scene: null as Scene<unknown, string, { x: number }> | null }));
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

describe('EasingsDemo', () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('plays every tween without adding an undo step per frame', () => {
    const queued = new Map<number, FrameRequestCallback>();
    let nextId = 1;
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      queued.set(nextId, cb);
      return nextId++;
    });
    vi.stubGlobal('cancelAnimationFrame', (id: number) => { queued.delete(id); });
    let now = 0;
    const step = (ms: number): void => {
      now += ms;
      const due = [...queued.values()];
      queued.clear();
      act(() => { for (const cb of due) cb(now); });
    };

    render(<EasingsDemo />);
    const scene = held.scene!;
    const ids = [...scene.renderOrder()];
    expect(ids.length).toBeGreaterThan(20);

    fireEvent.click(screen.getByRole('button', { name: /play all/ }));
    for (let i = 0; i < 4; i++) step(16);
    // Mid-flight, the frames are pose overrides the canvas reads.
    expect(scene.overrides.ids().length).toBe(ids.length);
    expect(scene.historyEntries()).toHaveLength(0);

    for (let i = 0; i < 120; i++) step(16);
    expect(scene.overrides.ids()).toHaveLength(0);
    expect(scene.historyEntries()).toHaveLength(0);
    expect(scene.canUndo()).toBe(false);
    const end = ids.map((id) => (scene.get(id)!.pose as { x: number }).x);
    expect(new Set(end)).toEqual(new Set([end[0]]));
    expect(end[0]).toBeGreaterThan(500);
  });
});
