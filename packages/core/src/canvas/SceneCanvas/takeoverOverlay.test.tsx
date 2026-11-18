/**
 * Under a `tools` takeover, the canvas's own always-on entries draw their overlays as they would without one:
 * gated on the active mode.
 *
 * The GL recorder is load-bearing: without a WebGL2 context every paint bails before drawing a layer.
 */
import { describe, it, expect, vi, beforeAll, afterEach } from 'vitest';
import { act, cleanup, render } from '@testing-library/react';
import { createModeRegistry, type ModeDefinition } from '@weasel-js/modes';
import { createGLRecorder } from '@weasel-js/renderer/testing/glRecorder';
import { SceneCanvas } from '../SceneCanvas';
import { createScene } from 'core/scene/scene';
import { IDENTITY_POSE_COMPOSITION } from 'core/scene/composeFrame';
import type { RenderLayer } from 'core/layers/render';
import type { SurfaceContribution } from '../surfaceContribution';
import { useTools } from '../../tools/overlayBinding';
import { WeaselProvider } from '../../WeaselProvider';

beforeAll(() => {
  const recorder = createGLRecorder();
  const proto = HTMLCanvasElement.prototype as unknown as Record<string, unknown>;
  proto.getContext = vi.fn((kind: unknown) => (kind === 'webgl2' ? recorder.gl : null));
  proto.setPointerCapture = vi.fn();
  proto.releasePointerCapture = vi.fn();
});

afterEach(() => { cleanup(); });

const frames = async (n: number) => {
  await act(async () => {
    for (let i = 0; i < n; i++) await new Promise<void>((r) => requestAnimationFrame(() => r()));
  });
};

const MODES: ModeDefinition[] = [
  { id: 'view', kind: 'soft', allows: [], scoping: false },
  { id: 'edit', kind: 'soft', allows: ['edits-anchors'], scoping: false },
];

/** An always-on entry needing `edits-anchors`, whose overlay counts its paints. No `deps`, so the command
 *  cache cannot serve it and every paint calls its draw. */
function gatedEntry(): { entry: SurfaceContribution; paints: () => number } {
  let count = 0;
  const overlay: RenderLayer<unknown> = {
    id: 'gated-overlay', label: 'gated', space: 'screen',
    draw: () => { count++; return []; },
  };
  const entry: SurfaceContribution = { id: 'gated', eligibility: { capabilities: ['edits-anchors'] }, overlay };
  return { entry, paints: () => count };
}

function Takeover({ ambient, modes }: { ambient: SurfaceContribution[]; modes: ReturnType<typeof createModeRegistry> }) {
  const scene = createScene<unknown, 'main', unknown>({ composition: IDENTITY_POSE_COMPOSITION, systemLayers: [{ id: 'main' }] });
  const tools = useTools({ active: null, registry: {} });
  return <SceneCanvas scene={scene} layers={{}} width={300} height={200} tools={tools} ambient={ambient} modes={modes} />;
}

describe('<SceneCanvas> always-on overlays under a tools takeover', () => {
  it('draws none whose capabilities the active mode bars, and draws it once the mode allows them', async () => {
    const modes = createModeRegistry({ modes: MODES, initial: 'view' });
    const { entry, paints } = gatedEntry();
    render(<WeaselProvider><Takeover ambient={[entry]} modes={modes} /></WeaselProvider>);
    await frames(3);
    expect(paints()).toBe(0);
    act(() => { modes.setMode('edit'); });
    await frames(3);
    expect(paints()).toBeGreaterThan(0);
  });
});
