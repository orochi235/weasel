/**
 * A layer that draws other layers passes their `subscribe` through, so
 * wrapping a layer never silences what repaints it.
 */
import { describe, it, expect, vi } from 'vitest';
import type { RenderLayer } from 'core/layers/render';
import { gateLayer } from 'features/focus/gateLayer';
import { createTiledLayer } from 'features/tiling/createTiledLayer';
import { createViewportLayer } from 'features/viewports/viewportLayer';
import { createParallaxLayer } from 'features/parallax/createParallaxLayer';

function source() {
  const listeners = new Set<() => void>();
  const layer: RenderLayer<unknown> = {
    id: 'src',
    label: 'src',
    draw: () => [],
    subscribe: (l) => { listeners.add(l); return () => { listeners.delete(l); }; },
  };
  return { layer, notify: () => { for (const l of [...listeners]) l(); }, count: () => listeners.size };
}

const wrappers: [string, (src: RenderLayer<unknown>) => RenderLayer<unknown>][] = [
  ['gateLayer', (src) => gateLayer({ layer: src, visible: () => true })],
  ['createTiledLayer', (src) => createTiledLayer({ id: 't', label: 't', source: [src], period: 100 })],
  ['createViewportLayer', (src) => createViewportLayer({
    id: 'v', label: 'v', source: [src], view: { x: 0, y: 0, scale: { x: 1, y: 1 } },
    bounds: () => ({ x: 0, y: 0, w: 10, h: 10 }),
  })],
  ['createParallaxLayer', (src) => createParallaxLayer({ id: 'p', label: 'p', source: [src], pan: 0.5 })],
];

describe.each(wrappers)('%s', (_name, wrap) => {
  it("forwards its source's notifications and unsubscribes from it", () => {
    const src = source();
    const wrapped = wrap(src.layer);
    const listener = vi.fn();
    const off = wrapped.subscribe!(listener);
    src.notify();
    expect(listener).toHaveBeenCalledOnce();
    off();
    expect(src.count()).toBe(0);
  });
});
