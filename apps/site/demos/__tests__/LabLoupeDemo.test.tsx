import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { act } from '@testing-library/react';
import { renderWithIcons } from '../../testIcons';
import { ForeignGl } from '../LabLoupeDemo';

// windease lays a lab's tiles out only once something measures them, and jsdom ships no ResizeObserver.
beforeAll(() => {
  if (typeof globalThis.ResizeObserver !== 'undefined') return;
  globalThis.ResizeObserver = class {
    #cb: ResizeObserverCallback;
    constructor(cb: ResizeObserverCallback) { this.#cb = cb; }
    observe(target: Element) {
      this.#cb([{ target, contentRect: { width: 800, height: 600, x: 0, y: 0, top: 0, left: 0 } } as ResizeObserverEntry], this);
    }
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
});

/** A WebGL context whose every call succeeds, counting what is made and what is deleted. */
function countingGl() {
  const live = new Set<object>();
  const gl = new Proxy({} as Record<string, unknown>, {
    get(_, key: string) {
      if (key === 'canvas') return document.createElement('canvas');
      if (/^[A-Z_]+$/.test(key)) return 1;
      return (...args: unknown[]) => {
        if (/^create(Program|Shader|Buffer)$/.test(key)) { const made = { key }; live.add(made); return made; }
        if (/^delete(Program|Shader|Buffer)$/.test(key)) { live.delete(args[0] as object); return undefined; }
        return key.startsWith('get') ? 1 : undefined;
      };
    },
  });
  return { gl, live };
}

describe('the loupe lab\'s foreign WebGL view', () => {
  afterEach(() => vi.restoreAllMocks());

  it("deletes the foreign GL view's program, shaders and buffer when it unmounts", async () => {
    const { gl, live } = countingGl();
    const real = HTMLCanvasElement.prototype.getContext;
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(function (this: HTMLCanvasElement, kind: string, ...rest: unknown[]) {
      return kind === 'webgl' ? gl : (real as (...a: unknown[]) => unknown).call(this, kind, ...rest);
    } as never);
    const view = renderWithIcons(<ForeignGl />);
    await act(async () => {});
    expect(live.size).toBeGreaterThan(0);
    view.unmount();
    expect([...live]).toEqual([]);
  });
});
