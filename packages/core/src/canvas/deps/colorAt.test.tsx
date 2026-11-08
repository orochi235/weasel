import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import { DepRegistryProvider, useDepRegistry, type DepRegistry } from '@weasel-js/routing/react';
import type { RenderLayer } from 'core/layers/render';
import type { LayerSampleArgs } from '../layerSample';
import { useColorAtDepSource, type ColorAtSource } from './colorAt';

const sampled = vi.hoisted(() => ({ calls: [] as unknown[], disposed: 0 }));
vi.mock('../layerSample', () => ({
  createLayerSampler: () => ({
    sample: (args: LayerSampleArgs) => {
      sampled.calls.push(args);
      return '#336699';
    },
    dispose: () => { sampled.disposed++; },
  }),
}));

beforeEach(() => {
  sampled.calls = [];
  sampled.disposed = 0;
});

function Capture({ onR }: { onR: (r: DepRegistry) => void }) {
  onR(useDepRegistry());
  return null;
}

function mount(source: ColorAtSource) {
  let reg!: DepRegistry;
  function Wire() {
    useColorAtDepSource(source);
    return null;
  }
  const view = render(
    <DepRegistryProvider>
      <Wire />
      <Capture onR={(r) => { reg = r; }} />
    </DepRegistryProvider>,
  );
  return { reg: () => reg, unmount: view.unmount };
}

const layer: RenderLayer<unknown> = { id: 'doc', label: 'Doc', draw: () => [] };
const view = { x: 1, y: 2, scale: { x: 3, y: 3 } };

describe('useColorAtDepSource', () => {
  it('samples the layers it is given at the point, at the current view and pixel ratio', () => {
    const { reg } = mount({
      layers: () => [layer],
      view: () => view,
      dims: () => ({ width: 100, height: 50, dpr: 2 }),
    });
    expect(reg().get('colorAt')?.({ x: 4, y: 5 })).toBe('#336699');
    expect(sampled.calls).toEqual([
      { layers: [layer], data: undefined, view, dims: { width: 100, height: 50, dpr: 2 }, point: { x: 4, y: 5 } },
    ]);
  });

  it('answers null before the canvas has a size, without sampling', () => {
    const { reg } = mount({ layers: () => [layer], view: () => view, dims: () => null });
    expect(reg().get('colorAt')?.({ x: 4, y: 5 })).toBeNull();
    expect(sampled.calls).toHaveLength(0);
  });

  it('frees its renderer on unmount', () => {
    const { unmount } = mount({ layers: () => [], view: () => view, dims: () => null });
    unmount();
    expect(sampled.disposed).toBeGreaterThan(0);
  });
});
