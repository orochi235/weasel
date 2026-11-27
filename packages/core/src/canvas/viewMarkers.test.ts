import { describe, it, expect, vi } from 'vitest';
import type { ViewMarkerHost, ViewMarkerProps } from 'domains/viewports/viewMarker';
import { createViewMarkerRegistry, type RegisteredMarker } from './viewMarkers';

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
