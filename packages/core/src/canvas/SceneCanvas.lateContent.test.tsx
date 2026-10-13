import { describe, it, expect, beforeAll, vi } from 'vitest';
import { render, act } from '@testing-library/react';
import { SceneCanvas } from './SceneCanvas';
import { createScene } from 'core/scene/scene';
import { registerPaintKind, getPaintKind } from 'core/paint/paintKinds';
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
