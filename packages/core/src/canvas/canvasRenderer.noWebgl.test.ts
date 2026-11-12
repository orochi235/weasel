/**
 * A browser that has WebGL 2 and still will not open a context on a canvas (acceleration off, the GPU blocklisted,
 * the canvas holding another kind of context) says so once, rather than leaving the canvas blank without a word.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { leaseCanvasRenderer } from './canvasRenderer';

const size = { width: 10, height: 10, dpr: 1 };
const setupGetContext = HTMLCanvasElement.prototype.getContext;

afterEach(() => {
  HTMLCanvasElement.prototype.getContext = setupGetContext;
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('a canvas the browser will not open WebGL 2 on', () => {
  it('warns once that it cannot be painted, and paints nothing', () => {
    vi.stubGlobal('WebGL2RenderingContext', function WebGL2RenderingContext() {});
    const getContext = vi.fn(() => null);
    HTMLCanvasElement.prototype.getContext = getContext as unknown as HTMLCanvasElement['getContext'];
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const lease = leaseCanvasRenderer();
    const canvas = document.createElement('canvas');
    expect(lease.bind(canvas, size)).toBeNull();
    expect(lease.bind(canvas, size)).toBeNull();
    expect(warn).toHaveBeenCalledTimes(1);
    expect(String(warn.mock.calls[0]![1])).toMatch(/WebGL 2/);
    expect(getContext).toHaveBeenCalledTimes(1);
    lease.release();
  });

  it('stays quiet where there is no WebGL at all, as under jsdom', () => {
    HTMLCanvasElement.prototype.getContext = (() => null) as unknown as HTMLCanvasElement['getContext'];
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const lease = leaseCanvasRenderer();
    expect(lease.bind(document.createElement('canvas'), size)).toBeNull();
    expect(warn).not.toHaveBeenCalled();
    lease.release();
  });
});
