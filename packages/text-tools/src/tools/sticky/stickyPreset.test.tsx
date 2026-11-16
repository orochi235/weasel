import { describe, it, expect, vi, beforeAll } from 'vitest';
import { render } from '@testing-library/react';
import { SceneCanvas, pickPreset, useScene, type SceneCanvasProps } from '@weasel-js/core';
import { createTextToolsPreset } from '../../presets';
import { STICKY_DEFAULTS } from './stickyNode';

type D = Record<string, unknown>;
type L = 'main';
type P = { x: number; y: number; width: number; height: number };
type ToolsApi = Parameters<NonNullable<SceneCanvasProps<D, L, P>['onToolsCreated']>>[0];

beforeAll(() => {
  (HTMLCanvasElement.prototype as unknown as { getContext: () => unknown }).getContext = vi.fn(() => null);
});

describe('createTextToolsPreset', () => {
  it('mounts sticky after the canvas’s own tools, in the look its options give it', () => {
    let captured: ToolsApi | null = null;
    const size = { width: 80, height: 50 };
    function Harness() {
      const scene = useScene<D, L, P>({ systemLayers: [{ id: 'main' }], initial: [] });
      return (
        <SceneCanvas features={[pickPreset, createTextToolsPreset({ sticky: { padding: 4, size } })]}
          scene={scene} width={100} height={100} layers={{}}
          onToolsCreated={(t) => { captured = t; }}
        />
      );
    }
    render(<Harness />);
    expect(Object.keys(captured!.registry)).toEqual(['select', 'lasso', 'text', 'sticky']);
    const click = captured!.registry.sticky.bindings!.find((b) => b.actionId === 'place');
    expect(click?.opts?.params).toEqual({ kind: 'sticky', minSize: STICKY_DEFAULTS.minSize, padding: 4, size });
  });
});
