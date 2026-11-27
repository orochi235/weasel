/** A `<Canvas>` with no renderer to paint through records no debug frame. */
import { describe, it, expect, vi, beforeAll } from 'vitest';
import { render, act } from '@testing-library/react';
import { Canvas } from '@weasel-js/core/testing/BareCanvas';
import type { CanvasDebugSink } from '../debug/types';
import type { RenderLayer } from 'core/layers/render';

beforeAll(() => {
  const proto = HTMLCanvasElement.prototype as unknown as { getContext: (...args: unknown[]) => unknown };
  proto.getContext = vi.fn(() => null);
});

const waitForFrame = () => new Promise<void>(r => requestAnimationFrame(() => r()));
const layer = (id: string): RenderLayer<unknown> => ({ id, label: id, draw: () => [] });

describe('<Canvas> debug frame without a renderer', () => {
  it('opens no frame and records no layers', async () => {
    const sinkRef = { current: null as CanvasDebugSink | null };
    render(
      <Canvas width={100} height={100} layers={{ mine: { layer: layer('mine') } }} debug={{ layers: true }} debugSinkRef={sinkRef} />,
    );
    await act(waitForFrame);
    await act(waitForFrame);
    expect(sinkRef.current!.snapshot().layers).toEqual([]);
  });
});
