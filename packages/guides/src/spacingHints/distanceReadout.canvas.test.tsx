/** The Alt-hover readout run by a real `<SceneCanvas>`, whose dispatcher
 *  builds each action's deps from its `requires` and throws on any other read. */
import { act, cleanup, render } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { asNodeId, createScene, SceneCanvas, type RectPose } from '@weasel-js/core';
import { createSpacingHintsPreset } from './preset';
import type { DistanceReadoutContribution } from './distanceReadout';

beforeAll(() => {
  const proto = HTMLCanvasElement.prototype as unknown as {
    setPointerCapture: (...args: unknown[]) => void;
    releasePointerCapture: (...args: unknown[]) => void;
  };
  proto.setPointerCapture = vi.fn();
  proto.releasePointerCapture = vi.fn();
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const rect = (id: string, x: number) => ({
  id: asNodeId(id), kind: 'mark' as const, layer: 'default' as const, pose: { x, y: 20, width: 40, height: 40 }, data: {},
});

describe('distanceReadout on a SceneCanvas', () => {
  it('measures to the shape under an Alt-hover without reading an undeclared dep', () => {
    const warn = vi.spyOn(console, 'warn');
    const scene = createScene<object, 'default', RectPose>({
      systemLayers: [{ id: 'default' }], initial: [rect('a', 20), rect('b', 120)],
    });
    const preset = createSpacingHintsPreset();
    const readout = preset.contributions!.find((c) => c.id === 'distanceReadout') as DistanceReadoutContribution;
    const { container } = render(
      <SceneCanvas features={['pick', preset]} width={300} height={200} scene={scene}
        selectionOptions={{ mode: 'multi', initial: [asNodeId('a')] }} />,
    );
    const canvas = container.querySelector('canvas')!;
    // jsdom's canvas rect is all zeros and the view is identity, so client coords are world coords.
    act(() => {
      canvas.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, clientX: 140, clientY: 40, altKey: true, pointerId: 1 }));
    });
    expect(warn.mock.calls.map((c) => String(c[0])).filter((m) => m.includes('did not declare'))).toEqual([]);
    expect(readout.read().gaps.length).toBeGreaterThan(0);
  });
});
