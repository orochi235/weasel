import { Profiler } from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { act, render } from '@testing-library/react';
import type { Scene } from '@weasel-js/core';
import { CustomShaderDemo } from '../CustomShaderDemo';

type AnyScene = Scene<unknown, string, { x: number; y: number }>;
const scenes = vi.hoisted(() => [] as AnyScene[]);
vi.mock('@weasel-js/core', async (importOriginal) => {
  const core = await importOriginal<typeof import('@weasel-js/core')>();
  return {
    ...core,
    useScene: (opts: never) => {
      const scene = core.useScene(opts) as unknown as AnyScene;
      if (!scenes.includes(scene)) scenes.push(scene);
      return scene;
    },
  };
});

describe('CustomShaderDemo', () => {
  afterEach(() => { vi.unstubAllGlobals(); });

  it('mounts without throwing', () => {
    const { container } = render(<CustomShaderDemo />);
    expect(container.querySelectorAll('canvas').length).toBeGreaterThanOrEqual(1);
  });

  it('animates without a React commit per frame', () => {
    const queued = new Map<number, FrameRequestCallback>();
    let nextId = 1;
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      queued.set(nextId, cb);
      return nextId++;
    });
    vi.stubGlobal('cancelAnimationFrame', (id: number) => { queued.delete(id); });
    const step = (now: number): void => {
      const due = [...queued.values()];
      queued.clear();
      act(() => { for (const cb of due) cb(now); });
    };

    let commits = 0;
    render(
      <Profiler id="demo" onRender={() => { commits++; }}>
        <CustomShaderDemo />
      </Profiler>,
    );
    step(0);
    step(16);
    const before = commits;
    step(32);
    step(48);
    step(64);
    expect(commits - before).toBe(0);
    // A loop that stopped would also commit nothing: a frame is still owed.
    expect(queued.size).toBeGreaterThan(0);
  });

  it('runs no frames while ?frozenTime holds the clock', () => {
    const queued = new Map<number, FrameRequestCallback>();
    let nextId = 1;
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      queued.set(nextId, cb);
      return nextId++;
    });
    vi.stubGlobal('cancelAnimationFrame', (id: number) => { queued.delete(id); });
    window.history.replaceState(null, '', '?frozenTime=1.5');
    try {
      render(<CustomShaderDemo />);
      for (let now = 0; now <= 32; now += 16) {
        const due = [...queued.values()];
        queued.clear();
        act(() => { for (const cb of due) cb(now); });
      }
      expect(queued.size).toBe(0);
    } finally {
      window.history.replaceState(null, '', '/');
    }
  });

  it('drags a Voronoi seed with the move action', () => {
    const proto = HTMLCanvasElement.prototype as unknown as Record<string, unknown>;
    proto.setPointerCapture = vi.fn();
    proto.releasePointerCapture = vi.fn();
    scenes.length = 0;
    const { container } = render(<CustomShaderDemo />);
    const seeds = scenes.find((s) => s.get('seed-0' as never))!;
    const canvas = container.querySelectorAll('canvas')[2]!;
    const start = seeds.get('seed-0' as never)!.pose;
    const fire = (type: string, x: number, y: number): void => act(() => {
      canvas.dispatchEvent(new PointerEvent(type, { bubbles: true, clientX: x, clientY: y, pointerId: 1, buttons: 1 }));
    });
    const cx = start.x + 6, cy = start.y + 6;
    fire('pointerdown', cx, cy);
    fire('pointermove', cx + 10, cy + 5);
    fire('pointermove', cx + 30, cy + 20);
    fire('pointerup', cx + 30, cy + 20);
    expect(seeds.get('seed-0' as never)!.pose).toMatchObject({ x: start.x + 30, y: start.y + 20 });
  });

  it('keeps a seed dragged past the edge on the panel, where it can be picked again', () => {
    const proto = HTMLCanvasElement.prototype as unknown as Record<string, unknown>;
    proto.setPointerCapture = vi.fn();
    proto.releasePointerCapture = vi.fn();
    scenes.length = 0;
    const { container } = render(<CustomShaderDemo />);
    const seeds = scenes.find((s) => s.get('seed-0' as never))!;
    const canvas = container.querySelectorAll('canvas')[2]!;
    const pose = () => seeds.get('seed-0' as never)!.pose;
    const fire = (type: string, x: number, y: number): void => act(() => {
      canvas.dispatchEvent(new PointerEvent(type, { bubbles: true, clientX: x, clientY: y, pointerId: 1, buttons: 1 }));
    });
    const drag = (from: { x: number; y: number }, dx: number, dy: number): void => {
      fire('pointerdown', from.x, from.y);
      fire('pointermove', from.x + dx / 2, from.y + dy / 2);
      fire('pointermove', from.x + dx, from.y + dy);
      fire('pointerup', from.x + dx, from.y + dy);
    };

    const start = pose();
    drag({ x: start.x + 6, y: start.y + 6 }, -500, -500);
    expect(pose()).toMatchObject({ x: 0, y: 0 });

    drag({ x: 6, y: 6 }, 40, 30);
    expect(pose()).toMatchObject({ x: 40, y: 30 });
  });
});
