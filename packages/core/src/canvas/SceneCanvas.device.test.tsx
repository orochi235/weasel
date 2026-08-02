/**
 * `<SceneCanvas device>` publishes one resolved {@link DeviceProfile} to its
 * whole subtree.
 *
 * The prop matters because the media queries are not always right — a hybrid
 * laptop reports a fine pointer while someone is using the touchscreen — and
 * because a test or a demo needs a coarse profile without stubbing
 * `matchMedia` globally.
 */
import { describe, it, expect, vi, beforeAll, afterEach } from 'vitest';
import { render } from '@testing-library/react';
import { useDeviceProfile } from '../core/device/useDeviceProfile';
import { COARSE_TARGET_SCALE } from '../core/device/profile';
import { SceneCanvas } from './SceneCanvas';
import { useScene } from 'core/scene/useScene';
import { asNodeId } from 'core/scene/types';

beforeAll(() => {
  const proto = HTMLCanvasElement.prototype as unknown as {
    getContext: (...args: unknown[]) => unknown;
    setPointerCapture: (...args: unknown[]) => void;
    releasePointerCapture: (...args: unknown[]) => void;
  };
  proto.getContext = vi.fn(() => ({
    canvas: { width: 0, height: 0 },
    clearRect: vi.fn(), fillRect: vi.fn(), strokeRect: vi.fn(),
    save: vi.fn(), restore: vi.fn(), translate: vi.fn(), setTransform: vi.fn(),
    scale: vi.fn(), setLineDash: vi.fn(), beginPath: vi.fn(), closePath: vi.fn(),
    moveTo: vi.fn(), lineTo: vi.fn(), arc: vi.fn(), stroke: vi.fn(), fill: vi.fn(),
    fillText: vi.fn(), measureText: vi.fn(() => ({ width: 10 })),
    font: '', textBaseline: '', globalAlpha: 1,
    fillStyle: '', strokeStyle: '', lineWidth: 1,
  } as unknown as CanvasRenderingContext2D));
  proto.setPointerCapture = vi.fn();
  proto.releasePointerCapture = vi.fn();
});

afterEach(() => {
  vi.restoreAllMocks();
});

type D = { color: string };
type L = 'main';
type P = { x: number; y: number; width: number; height: number };

function Probe({ onRead }: { onRead: (s: number) => void }) {
  const d = useDeviceProfile();
  onRead(d.targetScale);
  return null;
}

function Harness({
  device,
  onRead,
}: {
  device?: Parameters<typeof SceneCanvas>[0]['device'];
  onRead: (s: number) => void;
}) {
  const scene = useScene<D, L, P>({
    systemLayers: [{ id: 'main' }],
    initial: [{
      id: asNodeId('a'),
      kind: 'leaf',
      layer: 'main',
      pose: { x: 0, y: 0, width: 50, height: 50 },
      data: { color: '#f00' },
    }],
  });
  return (
    <SceneCanvas scene={scene} width={200} height={200} layers={{}} device={device}>
      <Probe onRead={onRead} />
    </SceneCanvas>
  );
}

describe('SceneCanvas device prop', () => {
  it('publishes the resolved profile to its subtree', () => {
    let seen = 0;
    render(<Harness device={{ coarsePointer: true }} onRead={(s) => { seen = s; }} />);
    expect(seen).toBe(COARSE_TARGET_SCALE);
  });

  it('defaults to a fine-pointer profile with no prop', () => {
    let seen = 0;
    render(<Harness onRead={(s) => { seen = s; }} />);
    expect(seen).toBe(1);
  });
});
