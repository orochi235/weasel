import { describe, expect, it, vi, beforeAll } from 'vitest';
import { render } from '@testing-library/react';
import { Canvas } from './testing/BareCanvas';
import { stubCanvasContext, waitForFrame } from './testing/stubCanvasContext';

beforeAll(stubCanvasContext);

describe('GL renderer', () => {
  // Both flags fail silently, not loudly: without `stencil` every evenodd fill
  // and clip renders as a solid shape; without `preserveDrawingBuffer`
  // readPixels() after render returns all zeros.
  it('calls getContext("webgl2") with preserveDrawingBuffer + stencil', async () => {
    const getCtxSpy = vi.spyOn(HTMLCanvasElement.prototype, 'getContext');
    render(<Canvas width={100} height={100} layers={{}} />);
    await waitForFrame();
    const webgl2Calls = getCtxSpy.mock.calls.filter((c) => c[0] === 'webgl2');
    expect(webgl2Calls.length).toBeGreaterThan(0);
    expect(webgl2Calls[0][1]).toMatchObject({ preserveDrawingBuffer: true, stencil: true });
    getCtxSpy.mockRestore();
  });

  it('does not call getContext("2d")', async () => {
    const getCtxSpy = vi.spyOn(HTMLCanvasElement.prototype, 'getContext');
    render(<Canvas width={100} height={100} layers={{}} />);
    await waitForFrame();
    expect(getCtxSpy).toHaveBeenCalled();
    const twoDCalls = getCtxSpy.mock.calls.filter((c) => c[0] === '2d');
    expect(twoDCalls).toHaveLength(0);
    getCtxSpy.mockRestore();
  });
});
