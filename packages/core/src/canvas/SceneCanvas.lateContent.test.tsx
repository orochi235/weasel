import { describe, it, expect, beforeAll, vi } from 'vitest';
import { render, act } from '@testing-library/react';
import { SceneCanvas } from './SceneCanvas';
import { createScene } from 'core/scene/scene';
import { registerPaintKind, getPaintKind } from 'core/paint/paintKinds';
import { refreshNodeShapes, registerNodeShape } from './NodeShape';
import type { RenderLayer } from '../core/layers/render';
import { makeGLRecorder } from '@weasel-js/renderer/testing/glRecorder';

beforeAll(() => {
  const recorder = makeGLRecorder();
  const proto = HTMLCanvasElement.prototype as unknown as { getContext: (...args: unknown[]) => unknown };
  proto.getContext = vi.fn((kind: unknown) => (kind === 'webgl2' ? recorder.gl : null));
});

const frame = () => new Promise<void>((r) => requestAnimationFrame(() => r()));

describe('<SceneCanvas> late content', () => {
  it('repaints when a paint kind registers, as a lazily loaded one does on landing', async () => {
    const scene = createScene<{ label: string }, 'main'>({ systemLayers: [{ id: 'main' }] });
    const draw = vi.fn(() => []);
    const probe: RenderLayer<unknown> = { id: 'probe', label: 'Probe', draw };
    render(<SceneCanvas width={100} height={100} scene={scene} layers={{ probe: { layer: probe } }} />);
    await frame();
    const before = draw.mock.calls.length;
    expect(before).toBeGreaterThan(0);

    let off = () => {};
    act(() => { off = registerPaintKind({ ...getPaintKind('solid')!, id: 'test-late' }); });
    await frame();
    off();

    expect(draw.mock.calls.length).toBeGreaterThan(before);
  });
});

describe('<SceneCanvas> node shapes', () => {
  async function drawsAfter(change: () => () => void): Promise<boolean> {
    const scene = createScene<{ label: string }, 'main'>({ systemLayers: [{ id: 'main' }] });
    const draw = vi.fn(() => []);
    const probe: RenderLayer<unknown> = { id: 'probe', label: 'Probe', draw };
    const { unmount } = render(<SceneCanvas width={100} height={100} scene={scene} layers={{ probe: { layer: probe } }} />);
    await frame();
    await frame();
    const before = draw.mock.calls.length;
    let undo = () => {};
    act(() => { undo = change(); });
    await frame();
    undo();
    unmount();
    return draw.mock.calls.length > before;
  }

  it('repaints when a node shape registers after the canvas mounted', async () => {
    expect(await drawsAfter(() => registerNodeShape({ id: 'test:late', matches: () => false, paint: () => [] }))).toBe(true);
  });

  it('repaints when a node shape is released', async () => {
    const off = registerNodeShape({ id: 'test:late', matches: () => false, paint: () => [] });
    expect(await drawsAfter(() => { off(); return () => {}; })).toBe(true);
  });

  it('repaints on refreshNodeShapes, as a late outline table does', async () => {
    expect(await drawsAfter(() => { refreshNodeShapes(); return () => {}; })).toBe(true);
  });
});
