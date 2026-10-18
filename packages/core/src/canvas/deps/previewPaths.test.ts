import { describe, expect, it, vi } from 'vitest';
import type { CanvasExtensionApi } from '../canvasExtension';
import type { RenderLayer } from 'core/layers/render';
import { createPreviewPaths, PREVIEW_PATHS_LAYER_ID } from './previewPaths';

const square = { kind: 'rect', x: 0, y: 0, width: 10, height: 10 } as const;

function fakeCanvas() {
  const layers: RenderLayer<unknown>[] = [];
  const api = {
    registerLayer: vi.fn((layer: RenderLayer<unknown>) => {
      layers.push(layer);
      return () => { layers.splice(layers.indexOf(layer), 1); };
    }),
    requestRedraw: vi.fn(),
  } as unknown as CanvasExtensionApi;
  const drawn = () => layers.flatMap((l) => l.draw(undefined, {} as never, {} as never) as unknown[]);
  return { api, layers, drawn };
}

describe('createPreviewPaths', () => {
  it('draws the paths on a layer attached while they are shown', () => {
    const c = fakeCanvas();
    const dep = createPreviewPaths(() => c.api);
    const hide = dep.show([{ path: square }]);
    expect(c.layers.map((l) => l.id)).toEqual([PREVIEW_PATHS_LAYER_ID]);
    expect(c.drawn()).toHaveLength(1);
    hide();
    expect(c.layers).toEqual([]);
  });

  it('lets a later show replace an earlier one, which then takes nothing down', () => {
    const c = fakeCanvas();
    const dep = createPreviewPaths(() => c.api);
    const first = dep.show([{ path: square }]);
    const second = dep.show([{ path: square }, { path: square }]);
    first();
    expect(c.drawn()).toHaveLength(2);
    expect(c.api.registerLayer).toHaveBeenCalledTimes(1);
    second();
    expect(c.layers).toEqual([]);
  });

  it('shows nothing before the canvas mounts', () => {
    const dep = createPreviewPaths(() => null);
    expect(() => dep.show([{ path: square }])()).not.toThrow();
  });
});
