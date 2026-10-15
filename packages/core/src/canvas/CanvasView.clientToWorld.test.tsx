/**
 * A surface's `clientToWorld` override reaches the views declared on it: which
 * view a client point is in, and where in that view's world it lands.
 */
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { useEffect } from 'react';
import { CanvasView } from './CanvasView';
import { ViewRegistryProvider, useOptionalViewRegistry, type ViewRegistry } from './viewRegistry';

const LEFT = 10;
const TOP = 20;
/** The panel occupies x ∈ [100, 200) of the canvas, looking at world (1000, 0). */
const PANEL = { x: 100, y: 0, w: 100, h: 100 };

/** A 300×200 canvas at client (10, 20), drawn at double size by a CSS
 *  transform: two client pixels to each of its own. */
function Surface({ onReady }: { onReady: (r: ViewRegistry) => void }) {
  const registry = useOptionalViewRegistry()!;
  useEffect(() => {
    onReady(registry);
    return registry.attachSurface({
      view: () => ({ x: 0, y: 0, scale: { x: 1, y: 1 } }),
      dims: () => ({ width: 300, height: 200 }),
      layers: () => [],
      requestRedraw: () => {},
      hitTestExtras: () => null,
      claimsAbove: () => false,
      clientToWorld: (x, y) => [(x - LEFT) / 2, (y - TOP) / 2],
      chromeState: () => ({
        selection: [], multiActive: false, boundsOf: () => null, unionBounds: null,
        modifiers: { alt: false, shift: false, meta: false, ctrl: false },
      }),
    });
  }, [registry, onReady]);
  return null;
}

function mount(): ViewRegistry {
  let registry!: ViewRegistry;
  render(
    <ViewRegistryProvider>
      <Surface onReady={(r) => { registry = r; }} />
      <CanvasView id="panel" bounds={PANEL} defaultView={{ x: 1000, y: 0, scale: { x: 1, y: 1 } }} />
    </ViewRegistryProvider>,
  );
  return registry;
}

/** Canvas pixel (150, 50), inside the panel. By the element's rect alone it
 *  would be canvas pixel (300, 100), off the panel's right edge. */
const CLIENT = [LEFT + 2 * 150, TOP + 2 * 50] as const;

describe('a view on a surface with a clientToWorld override', () => {
  it('resolves a client point to the view it is drawn in', () => {
    const target = mount().resolver.at(null, ...CLIENT);
    expect(target.id).toBe('panel');
    expect(target.world).toEqual({ x: 1050, y: 50 });
  });

  it('converts a client point into the view\'s world for its dispatcher', () => {
    const toWorld = mount().list()[0]!.target.clientToWorld!;
    expect(toWorld(...CLIENT)).toEqual({ x: 1050, y: 50 });
  });
});
