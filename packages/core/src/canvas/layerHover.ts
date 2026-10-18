import { isLayerPainted, type Dims, type RenderLayer } from 'core/layers/render';
import type { View } from 'core/viewport/view';
import type { SurfaceInputHandlers } from './useSurfaceInput';
import { NO_LAYER_VISIBILITY } from './useExtraLayers';

/** Where a hover lands, as of the render that built the handlers. */
export interface HoverFrame {
  viewRef: { readonly current: View };
  toWorld: (clientX: number, clientY: number) => [number, number];
  layerVisibility: Record<string, boolean> | undefined;
  layerOrder: string[] | undefined;
  dims: Dims;
}

/** Deliver an uncaptured hover, and the pointer leaving, to every painted layer that asks. */
export function layerHover(
  layers: readonly RenderLayer<unknown>[],
  frame: HoverFrame,
): Pick<SurfaceInputHandlers, 'onHover' | 'onLeave'> {
  return {
    onHover: (_el, e) => {
      const view = frame.viewRef.current;
      const [worldX, worldY] = frame.toWorld(e.clientX, e.clientY);
      const visibility = frame.layerVisibility ?? NO_LAYER_VISIBILITY;
      // Same gate as `hitTestExtrasIn`: a layer nobody can see takes no input.
      for (const layer of layers) {
        if (!layer.onUncapturedMove || !isLayerPainted(layer, visibility, frame.layerOrder)) continue;
        layer.onUncapturedMove(worldX, worldY, e, view, { width: frame.dims.width, height: frame.dims.height });
      }
    },
    onLeave: () => {
      for (const layer of layers) layer.onUncapturedLeave?.();
    },
  };
}
