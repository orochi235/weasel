import { describe, it, expect, vi, afterEach } from 'vitest';
import type { ViewMarkerHost, ViewMarkerProps } from 'domains/viewports/viewMarker';
import { createViewMarkerRegistry, type RegisteredMarker } from './viewMarkers';

function registry() {
  const markers = new Map<() => ViewMarkerProps, RegisteredMarker>();
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
    expect(reg.markerLayers('pip')).toEqual([markers.get(first)!.layer]);
    off();
    expect(reg.markerLayers('pip')).toEqual([markers.get(second)!.layer]);
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
    expect(reg.markerLayers('pip')).toEqual([markers.get(a)!.layer]);
    expect(error).toHaveBeenCalledTimes(1);
    reg.markerLayers('pip');
    expect(error).toHaveBeenCalledTimes(1);
  });
});

describe('createViewMarkerRegistry', () => {
  it('lists a marker in the frame it registered for until it registers again', () => {
    const registry = createViewMarkerRegistry(new Map<() => ViewMarkerProps, RegisteredMarker>(), {
      host: {} as ViewMarkerHost, surface: () => null, resolve: () => undefined, changed: vi.fn(),
    });
    let props: ViewMarkerProps = { id: 'm', source: 'a', target: null };
    const read = (): ViewMarkerProps => props;
    const off = registry.registerMarker(read);
    props = { ...props, target: 'pip' };
    // Root's list is memoized on registrations and a view's is read each frame; both answer the same.
    expect(registry.markerLayers(null)).toHaveLength(1);
    expect(registry.markerLayers('pip')).toHaveLength(0);

    off();
    registry.registerMarker(read);
    expect(registry.markerLayers(null)).toHaveLength(0);
    expect(registry.markerLayers('pip')).toHaveLength(1);
  });
});
