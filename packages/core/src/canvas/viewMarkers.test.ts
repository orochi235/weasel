import { describe, it, expect, vi, afterEach } from 'vitest';
import type { RenderLayer } from 'core/layers/render';
import type { ViewMarkerProps } from 'domains/viewports/viewMarker';
import { createViewMarkerRegistry } from './viewMarkers';

function registry() {
  const markers = new Map<() => ViewMarkerProps, RenderLayer<unknown>>();
  const reg = createViewMarkerRegistry(markers, {
    host: { aimOf: () => null, setAim: () => false },
    surface: () => null,
    resolve: () => undefined,
    changed: () => {},
  });
  return { markers, reg };
}

const error = vi.spyOn(console, 'error').mockImplementation(() => {});
afterEach(() => error.mockClear());

describe('registerMarker', () => {
  it('lets a marker skipped for a taken id take over when the holder leaves', () => {
    const { markers, reg } = registry();
    const first = (): ViewMarkerProps => ({ id: 'm', source: null, target: 'pip' });
    const second = (): ViewMarkerProps => ({ id: 'm', source: null, target: 'pip' });
    const off = reg.registerMarker(first);
    reg.registerMarker(second);
    expect(error).toHaveBeenCalledWith(expect.stringContaining('marker "m" is already on this surface'));
    expect(reg.markerLayers('pip')).toEqual([markers.get(first)]);
    off();
    expect(reg.markerLayers('pip')).toEqual([markers.get(second)]);
  });

  it('skips a marker whose props change to an id another marker holds', () => {
    const { markers, reg } = registry();
    let id = 'b';
    const a = (): ViewMarkerProps => ({ id: 'a', source: null, target: 'pip' });
    const b = (): ViewMarkerProps => ({ id, source: null, target: 'pip' });
    reg.registerMarker(a);
    reg.registerMarker(b);
    expect(reg.markerLayers('pip')).toHaveLength(2);
    id = 'a';
    expect(reg.markerLayers('pip')).toEqual([markers.get(a)]);
    expect(error).toHaveBeenCalledTimes(1);
    reg.markerLayers('pip');
    expect(error).toHaveBeenCalledTimes(1);
  });
});
