/**
 * A layer that draws other layers passes their `subscribe` through, so
 * wrapping a layer never silences what repaints it.
 */
import { describe, it, expect, vi } from 'vitest';
import type { RenderLayer } from '@weasel-js/core';
import { createTiledLayer } from './createTiledLayer';
import { createParallaxLayer } from './createParallaxLayer';

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
  ['createTiledLayer', (src) => createTiledLayer({ id: 't', label: 't', source: [src], period: 100 })],
  ['createParallaxLayer', (src) => createParallaxLayer({ id: 'p', label: 'p', source: [src], parallax: { pan: 0.5 } })],
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
