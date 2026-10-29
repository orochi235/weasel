import { Profiler } from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { act, render } from '@testing-library/react';
import { CustomShaderDemo } from '../CustomShaderDemo';

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
});
