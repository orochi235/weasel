import { act, cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Lines3dDemo } from '../Lines3dDemo';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('Lines3dDemo', () => {
  it('stops asking for frames when no WebGL2 context can be made', () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
    const queued = new Map<number, FrameRequestCallback>();
    let nextId = 1;
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => { queued.set(nextId, cb); return nextId++; });
    vi.stubGlobal('cancelAnimationFrame', (id: number) => { queued.delete(id); });
    render(<Lines3dDemo />);
    let now = 0;
    for (let i = 0; i < 5; i++) {
      now += 16;
      const due = [...queued.values()];
      queued.clear();
      act(() => { for (const cb of due) cb(now); });
    }
    expect(queued.size).toBe(0);
  });
});
