/**
 * `<Canvas>` as the surface of a view registry: what it attaches, and that it
 * takes it back.
 */
import { describe, it, expect, vi, beforeAll } from 'vitest';
import { render } from '@testing-library/react';
import { Canvas } from './testing/BareCanvas';
import { ViewRegistryProvider, useOptionalViewRegistry, type SurfaceHandle, type ViewRegistry } from './viewRegistry';

beforeAll(() => {
  const proto = HTMLCanvasElement.prototype as unknown as { getContext: (...args: unknown[]) => unknown };
  proto.getContext = vi.fn(() => null);
});

function Probe({ onRegistry }: { onRegistry: (r: ViewRegistry) => void }) {
  onRegistry(useOptionalViewRegistry()!);
  return null;
}

const handle = (): SurfaceHandle => ({
  origin: () => ({ left: 0, top: 0 }),
  view: () => ({ x: 0, y: 0, scale: { x: 1, y: 1 } }),
  dims: () => ({ width: 1, height: 1 }),
  layers: () => [],
  requestRedraw: () => {},
  hitTestExtras: () => null,
  claimsAbove: () => false,
  clientToWorld: (x, y) => [x, y],
  chromeState: () => ({
    selection: [], multiActive: false, boundsOf: () => null, unionBounds: null,
    modifiers: { alt: false, shift: false, meta: false, ctrl: false },
  }),
});

describe('<Canvas> surface attachment', () => {
  it('detaches its handle from the registry when it unmounts', () => {
    let registry!: ViewRegistry;
    const ui = (mounted: boolean) => (
      <ViewRegistryProvider>
        <Probe onRegistry={(r) => { registry = r; }} />
        {mounted && <Canvas width={100} height={100} layers={{}} />}
      </ViewRegistryProvider>
    );
    const { rerender } = render(ui(true));
    expect(registry.surface()).not.toBeNull();
    rerender(ui(false));
    expect(registry.surface()).toBeNull();
  });

  it('leaves a handle another surface attached since', () => {
    let registry!: ViewRegistry;
    render(
      <ViewRegistryProvider>
        <Probe onRegistry={(r) => { registry = r; }} />
      </ViewRegistryProvider>,
    );
    const second = handle();
    const detachFirst = registry.attachSurface(handle());
    registry.attachSurface(second);
    detachFirst();
    expect(registry.surface()).toBe(second);
  });
});
