import { describe, expect, it } from 'vitest';
import { renderHook } from '@testing-library/react';
import type { RenderLayer } from 'core/layers/render';
import type { SelectionApi } from '@weasel-js/routing';
import { useViewNesting, type ViewNestingInputs } from './useViewNesting';
import type { ViewRegistration, ViewRegistry } from './viewRegistry';

const VIEW: View = { x: 0, y: 0, scale: { x: 1, y: 1 } };
const layer = (id: string) => ({ id }) as unknown as RenderLayer<unknown>;
const SURFACE = [layer('scene:a'), layer('scene:b')];

function harness() {
  const regs = new Map<string, ViewRegistration>();
  const registry = {
    get: (id: string) => regs.get(id),
    surface: () => ({ layers: () => SURFACE }),
  } as unknown as ViewRegistry;
  const mount = (id: string, inputs: Partial<ViewNestingInputs>) => {
    const live = { current: { shared: {} as SelectionApi, bounds: { x: 0, y: 0, width: 10, height: 10 }, ...inputs } };
    const { result } = renderHook(() => useViewNesting(registry, live));
    regs.set(id, {
      id,
      drawnLayers: () => result.current.drawnLayers(),
      layerIsPainted: (l: string) => result.current.layerIsPainted(l),
    } as unknown as ViewRegistration);
    return result;
  };
  return { mount };
}

describe('useViewNesting', () => {
  it('finds nothing painted in views whose parents loop, rather than overflowing the stack', () => {
    const { mount } = harness();
    const a = mount('a', { parent: 'b' });
    mount('b', { parent: 'a' });
    expect(a.current.drawnLayers()).toEqual([]);
    expect(a.current.layerIsPainted('a')).toBe(false);
  });

  it('keeps the parent gate on a nested view that follows another', () => {
    const { mount } = harness();
    mount('parent', { layers: (s) => s.filter((l) => l.id === 'scene:a') });
    mount('leader', {});
    const v = mount('v', { parent: 'parent', follows: () => 'leader' });
    expect(v.current.drawnLayers().map((l) => l.id)).toEqual(['scene:a']);
    expect(v.current.layerIsPainted('a')).toBe(true);
    expect(v.current.layerIsPainted('b')).toBe(false);
  });
});
