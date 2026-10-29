import { useEffect, useReducer } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { actSettled, renderSettled } from './renderSettled';

/** Re-renders on every animation frame, each render taking `ms`. */
function Animated({ ms }: { ms: number }) {
  const [frames, tick] = useReducer((n: number) => n + 1, 0);
  useEffect(() => {
    let id = requestAnimationFrame(function frame() {
      tick();
      id = requestAnimationFrame(frame);
    });
    return () => cancelAnimationFrame(id);
  }, []);
  const until = performance.now() + ms;
  while (performance.now() < until) {}
  return <output>{frames}</output>;
}

// A frame due on every turn of the event loop, as on a machine too loaded to render within one.
const frameEveryTurn = () =>
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) =>
    setTimeout(() => cb(performance.now()), 0),
  );

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('renderSettled', () => {
  it('returns from a tree that re-renders on every frame, and its frames run on after', async () => {
    frameEveryTurn();
    const { container, unmount } = await renderSettled(<Animated ms={3} />);
    const shown = () => Number(container.textContent);
    const settled = shown();
    await actSettled(() => new Promise((r) => setTimeout(r, 30)));
    expect(shown()).toBeGreaterThan(settled);
    unmount();
  });

  it('runs no frame canceled while it held them', async () => {
    const ran = vi.fn();
    await actSettled(async () => {
      const id = requestAnimationFrame(ran);
      await new Promise((r) => setTimeout(r, 40));
      cancelAnimationFrame(id);
    });
    await new Promise((r) => setTimeout(r, 40));
    expect(ran).not.toHaveBeenCalled();
  });
});
