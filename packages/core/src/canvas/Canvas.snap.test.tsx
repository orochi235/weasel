/**
 * While its view moves, `<Canvas>` draws the translation rounded to whole
 * device pixels, so a retained layer panned by fractions of one is composited
 * moved; once the view holds it draws exactly. Real `WeaselRenderer` against
 * the recording context.
 */

import React from 'react';
import { describe, it, expect, vi, beforeAll, afterEach } from 'vitest';
import { act, render } from '@testing-library/react';
import { viewToMat3, WeaselRenderer, type DrawCommand, type GroupDrawCommand } from '@weasel-js/renderer';
import { makeGLRecorder } from '@weasel-js/renderer/testing/glRecorder';
import { Canvas } from './testing/BareCanvas';
import type { CanvasExtensionApi } from './canvasExtension';
import type { CanvasRetainOptions } from './canvasProps';
import type { RenderLayer } from '../core/layers/render';
import type { View } from '../core/viewport/view';

beforeAll(() => {
  const recorder = makeGLRecorder();
  const proto = HTMLCanvasElement.prototype as unknown as {
    getContext: (...args: unknown[]) => unknown;
    setPointerCapture: (...args: unknown[]) => void;
    releasePointerCapture: (...args: unknown[]) => void;
  };
  proto.getContext = vi.fn((kind: unknown) => (kind === 'webgl2' ? recorder.gl : null));
  proto.setPointerCapture = vi.fn();
  proto.releasePointerCapture = vi.fn();
});

afterEach(() => { vi.restoreAllMocks(); });

const waitForFrame = () => new Promise<void>(r => requestAnimationFrame(() => r()));

const CMDS: DrawCommand[] = Array.from({ length: 8 }, (_, i) => ({
  kind: 'path' as const,
  path: { kind: 'rect' as const, x: 20 + i, y: 20, width: 1, height: 1 },
  fill: { paint: { kind: 'solid' as const, color: '#fff' } },
}));

let hitView: View | null = null;
const LAYER: RenderLayer<unknown> = {
  id: 'probe', label: 'Probe', retain: true, deps: () => ['stable'], draw: () => CMDS,
  hitTest: (_x, _y, _data, view) => { hitView = view; return null; },
};

/** The world transform the frame drew the probe layer under. */
const drawnAt = (cmds: DrawCommand[]) =>
  Array.from(cmds.find((c): c is GroupDrawCommand => c.kind === 'group' && c.transform !== undefined)!.transform!);

/** Mount at 2x, let the probe's surface be drawn, then pan by `step` CSS px a
 *  frame for `frames` frames. Returns what each panned frame cost the
 *  renderer and what it was drawn under. */
async function pan(retain: CanvasRetainOptions | undefined, step: number, frames: number) {
  const spy = vi.spyOn(WeaselRenderer.prototype, 'render');
  const ref = React.createRef<CanvasExtensionApi>();
  render(<Canvas ref={ref} width={100} height={100} dpr={2} retain={retain} layers={{ grid: null }} />);
  act(() => { ref.current!.registerLayer(LAYER); });
  for (let i = 0; i < 3; i++) {
    act(() => { ref.current!.requestRedraw(); });
    await waitForFrame();
  }
  const moving = [];
  for (let i = 0; i < frames; i++) {
    act(() => { ref.current!.setView((v) => ({ ...v, x: v.x - step })); });
    await waitForFrame();
    const renderer = spy.mock.contexts.at(-1) as WeaselRenderer;
    const [cmds, viewMatrix] = spy.mock.calls.at(-1)!;
    moving.push({ stats: renderer.lastFrameStats().retained, at: drawnAt(cmds), viewMatrix: Array.from(viewMatrix!) });
  }
  return { ref, spy, moving };
}

describe('Canvas view snapping', () => {
  it('composites a retained layer panned by fractions of a device pixel', async () => {
    // 0.3 CSS px is 0.6 device px at 2x.
    const { moving } = await pan(undefined, 0.3, 4);
    for (const frame of moving) {
      expect(frame.stats).toMatchObject({ composited: 1, declined: 0 });
      const device = frame.at[6]! * 2;
      expect(Math.abs(device - Math.round(device))).toBeLessThan(1e-9);
      expect(frame.viewMatrix).toEqual(frame.at);
    }
  });

  it('draws the exact translation once the view holds', async () => {
    const { ref, spy } = await pan(undefined, 0.3, 4);
    await waitForFrame();
    await waitForFrame();
    const exact = Array.from(viewToMat3(ref.current!.getView()));
    const [cmds, viewMatrix] = spy.mock.calls.at(-1)!;
    expect(drawnAt(cmds)).toEqual(exact);
    expect(Array.from(viewMatrix!)).toEqual(exact);
  });

  it('hit-tests against the exact view while it moves', async () => {
    const { ref, moving } = await pan(undefined, 0.3, 1);
    const view = ref.current!.getView();
    expect(moving[0]!.at).not.toEqual(Array.from(viewToMat3(view)));
    expect(view.x).toBeCloseTo(-0.3, 12);
    expect(ref.current!.clientToWorld(10, 10)[0]).toBeCloseTo(10 - 0.3, 12);
    hitView = null;
    act(() => { ref.current!.hitTestExtras(10, 10); });
    expect(hitView).toEqual(view);
  });

  it('draws every frame exactly with snap off, and the moved layer straight through', async () => {
    const { ref, moving } = await pan({ whole: false }, 0.3, 2);
    expect(moving.at(-1)!.at).toEqual(Array.from(viewToMat3(ref.current!.getView())));
    expect(moving.map((f) => f.stats.declined)).toEqual([1, 1]);
  });
});
