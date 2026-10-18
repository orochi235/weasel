/**
 * `<Canvas retain>` sets which layers the renderer keeps as pixels, and what
 * it may spend on them. Real `WeaselRenderer` against the recording context:
 * it sees which groups carry `retain` and what the surfaces declined, never a
 * pixel.
 */

import { describe, it, expect, vi, beforeAll, afterEach } from 'vitest';
import { render } from '@testing-library/react';
import { WeaselRenderer, type DrawCommand, type GroupDrawCommand } from '@weasel-js/renderer';
import { makeGLRecorder } from '@weasel-js/renderer/testing/glRecorder';
import { Canvas } from './testing/BareCanvas';
import type { RenderLayer } from '../core/layers/render';
import type { CanvasRetainOptions } from './canvasProps';

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

function rects(n: number): DrawCommand[] {
  return Array.from({ length: n }, (_, i) => ({
    kind: 'path' as const,
    path: { kind: 'rect' as const, x: i, y: 0, width: 1, height: 1 },
    fill: { paint: { kind: 'solid' as const, color: '#fff' } },
  }));
}

const CMDS = rects(8);
const LAYER: RenderLayer<unknown> = {
  id: 'probe', label: 'Probe', space: 'screen', deps: () => ['stable'], draw: () => CMDS,
};

/** Paint the probe layer on three frames and return what each render was
 *  handed, with the renderer that drew it. */
async function paint(retain: false | CanvasRetainOptions | undefined) {
  const spy = vi.spyOn(WeaselRenderer.prototype, 'render');
  const el = (r: typeof retain) => (
    <Canvas width={100} height={100} retain={r} layers={{ grid: null, probe: { layer: LAYER } }} />
  );
  const { rerender } = render(el(retain));
  await waitForFrame();
  rerender(el(retain));
  await waitForFrame();
  rerender(el(retain));
  await waitForFrame();
  const frames = spy.mock.calls.map(([cmds]) => cmds);
  const renderer = spy.mock.contexts.at(-1) as WeaselRenderer;
  return { frames, renderer, rerender: (r: typeof retain) => rerender(el(r)), spy };
}

const retainedIds = (frames: DrawCommand[][]): (string | undefined)[] =>
  frames.map((cmds) => cmds.find((c): c is GroupDrawCommand => c.kind === 'group' && c.retain !== undefined)?.retain);

describe('Canvas retain prop', () => {
  it('retains a layer under the threshold it sets', async () => {
    const { frames } = await paint({ minCommands: 4 });
    expect(retainedIds(frames)).toContain('probe');
  });

  it('keeps the default threshold when it is unset', async () => {
    const { frames } = await paint(undefined);
    expect(retainedIds(frames).every((id) => id === undefined)).toBe(true);
  });

  it('retains nothing when false, even a layer asking to be retained', async () => {
    const asking = { ...LAYER, retain: true };
    const spy = vi.spyOn(WeaselRenderer.prototype, 'render');
    const el = <Canvas width={100} height={100} retain={false} layers={{ grid: null, probe: { layer: asking } }} />;
    const { rerender } = render(el);
    await waitForFrame();
    rerender(<Canvas width={100} height={100} retain={false} layers={{ grid: null, probe: { layer: asking } }} />);
    await waitForFrame();
    expect(retainedIds(spy.mock.calls.map(([cmds]) => cmds)).every((id) => id === undefined)).toBe(true);
  });

  it('hands the renderer its budget at creation, and a changed one later', async () => {
    const { renderer, rerender } = await paint({ minCommands: 4, budget: 0 });
    expect(renderer.lastFrameStats().retained.declined).toBe(1);

    const set = vi.spyOn(WeaselRenderer.prototype, 'setRetainBudget');
    rerender({ minCommands: 4, budget: 1 << 20 });
    await waitForFrame();
    expect(set).toHaveBeenCalledWith(1 << 20);
  });
});
