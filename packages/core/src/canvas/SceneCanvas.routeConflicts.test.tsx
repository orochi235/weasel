/**
 * Kit-vs-kit route conflicts are always a bug, and this is where they fail.
 *
 * `useTools` reports route conflicts with a `console.warn` at dev-time, which
 * is the right severity for a *consumer's* tool colliding with a kit tool —
 * that can be deliberate, since the loser can still take the gesture by
 * declining through `enabled()`. Two built-in tools claiming the same
 * (phase, gesture, arg, target, modifiers) tuple has no such reading: slot
 * order alone would decide which one fires. So the escalation from "warn" to
 * "throw" lives here rather than at runtime.
 */
import { describe, it, expect, vi, beforeAll, afterEach } from 'vitest';
import { render } from '@testing-library/react';
import { SceneCanvas } from './SceneCanvas';
import { BUNDLE_TOOLS } from './SceneCanvas';
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

function Harness({ bundle }: { bundle: 'minimal' | 'standard' | 'exhaustive' }) {
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
  return <SceneCanvas scene={scene} width={200} height={200} layers={{}} toolBundle={bundle} />;
}

describe('built-in tool bundles declare no conflicting routes', () => {
  for (const bundle of ['minimal', 'standard', 'exhaustive'] as const) {
    it(`${bundle} (${BUNDLE_TOOLS[bundle].join(', ')})`, () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      render(<Harness bundle={bundle} />);
      const conflicts = warn.mock.calls
        .map((args) => String(args[0]))
        .filter((m) => m.includes('route conflict'));
      expect(conflicts).toEqual([]);
    });
  }
});
