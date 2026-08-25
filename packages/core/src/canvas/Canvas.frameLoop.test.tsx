/**
 * The paint runs on a frame loop, not on a React commit: many redraw requests
 * in one tick collapse into one paint, and a paint costs no render.
 */

import { describe, it, expect, beforeAll, afterEach, vi } from 'vitest';
import { render, act, cleanup } from '@testing-library/react';
import { Profiler } from 'react';
import type React from 'react';
import { Canvas } from './Canvas';
import type { CanvasExtensionApi } from './canvasExtension';
import { makeGLRecorder } from '../renderer/test-utils/glRecorder';

beforeAll(() => {
  const recorder = makeGLRecorder();
  const proto = HTMLCanvasElement.prototype as unknown as {
    getContext: (...args: unknown[]) => unknown;
  };
  proto.getContext = vi.fn((kind: unknown) => (kind === 'webgl2' ? recorder.gl : null));
});

afterEach(() => { cleanup(); });

const frame = () => new Promise<void>((r) => requestAnimationFrame(() => r()));

function Host({ apiRef }: { apiRef: React.RefObject<CanvasExtensionApi | null> }) {
  return <Canvas ref={apiRef} width={100} height={80} layers={{}} />;
}

describe('Canvas frame loop', () => {
  it('coalesces many requestRedraw calls in one tick into a single paint', async () => {
    const apiRef = { current: null as CanvasExtensionApi | null };
    render(<Host apiRef={apiRef} />);
    await frame();

    const painted = vi.fn();
    apiRef.current!.subscribeFrame!(painted);

    act(() => {
      apiRef.current!.requestRedraw();
      apiRef.current!.requestRedraw();
      apiRef.current!.requestRedraw();
    });
    await frame();
    await frame();

    expect(painted).toHaveBeenCalledTimes(1);
  });

  it('does not re-render to paint', async () => {
    const apiRef = { current: null as CanvasExtensionApi | null };
    let commits = 0;
    render(
      <Profiler id="canvas" onRender={() => { commits++; }}>
        <Host apiRef={apiRef} />
      </Profiler>,
    );
    await frame();
    const before = commits;

    act(() => { apiRef.current!.requestRedraw(); });
    await frame();
    await frame();

    expect(commits).toBe(before);
  });
});
