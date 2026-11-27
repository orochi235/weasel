/**
 * The marker half of a surface's view registry: which markers are live, the
 * layers they draw, and which one a press lands on.
 */
import type { Dims, RenderLayer } from 'core/layers/render';
import type { AffordanceHit } from '@weasel-js/routing';
import { aimSpace2d, type AimSpace } from 'domains/viewports/aim';
import type { ResolvableView } from 'domains/viewports/viewResolver';
import type { View } from 'core/viewport/view';
import {
  createViewMarkerLayer, grabViewMarker, type ViewMarkerHost, type ViewMarkerProps,
} from 'domains/viewports/viewMarker';
import { layerAffordance } from './affordanceAt';

/** @internal Composed into `ViewRegistry`. */
export interface ViewMarkerRegistry {
  /** Returns an unregister. `props` is read at every draw, but its `target` only here: a retargeted
   *  marker registers again. An id already live
   *  on the surface logs an error and is skipped, and its unregister does nothing. */
  registerMarker(props: () => ViewMarkerProps): () => void;
  /** The layers of the markers drawn in `target`'s frame, in mount order. */
  markerLayers(target: string | null): readonly RenderLayer<unknown>[];
  /** The topmost interactive marker drawn in `target` under `world` (a point
   *  in `target`'s world), as the affordance a press there routes. */
  markerAt(target: string | null, world: { x: number; y: number }): AffordanceHit | null;
  /** Lets `markerAt` answer while `open()` says the surface binds a marker drag;
   *  until then it answers `null`, so a press falls through. Returns an undo. */
  gateMarkers(open: () => boolean): () => void;
}

/** @internal A live marker: its layer, and the frame it was registered to draw in. A stack lists it by that
 *  target, not a live read, so every stack agrees until the marker registers again under a new one. */
export interface RegisteredMarker {
  layer: RenderLayer<unknown>;
  target: string | null;
}

/** What the marker half reads off the rest of the registry. */
export interface ViewMarkerRegistryDeps {
  host: ViewMarkerHost;
  /** The surface's camera and size, or `null` before one attaches. */
  surface(): { view(): View; dims(): Dims } | null;
  /** View `id` resolved against the surface, or `undefined` while there is none. */
  resolve(id: string, outer: View, dims: Dims): ResolvableView | undefined;
  changed(): void;
}

/** @internal */
export function createViewMarkerRegistry(
  markers: Map<() => ViewMarkerProps, RegisteredMarker>,
  deps: ViewMarkerRegistryDeps,
): ViewMarkerRegistry {
  let gate: (() => boolean) | null = null;
  const targetSpace = (target: string | null): AimSpace | null => {
    const surface = deps.surface();
    if (!surface) return null;
    if (target === null) return aimSpace2d(null, surface.view(), surface.dims());
    const v = deps.resolve(target, surface.view(), surface.dims());
    return v ? aimSpace2d(target, v.view, v.rect) : null;
  };
  return {
    registerMarker: (props) => {
      const { id } = props();
      for (const live of markers.keys()) {
        if (live().id === id) {
          console.error(`[weasel] registerMarker: marker "${id}" is already on this surface, so this one is skipped. Marker ids are unique per surface; rename one.`);
          return () => {};
        }
      }
      markers.set(props, { layer: createViewMarkerLayer(props, deps.host), target: props().target });
      deps.changed();
      return () => { markers.delete(props); deps.changed(); };
    },
    markerLayers: (target) => {
      const out: RenderLayer<unknown>[] = [];
      for (const marker of markers.values()) if (marker.target === target) out.push(marker.layer);
      return out;
    },
    markerAt: (target, world) => {
      if (!gate?.()) return null;
      const space = targetSpace(target);
      const at = space?.project(world);
      if (!space || !at) return null;
      const live = [...markers];
      for (let i = live.length - 1; i >= 0; i--) {
        const [read, marker] = live[i]!;
        if (marker.target !== target) continue;
        const props = read();
        const grab = grabViewMarker(props, deps.host, space, at);
        if (grab) return layerAffordance(`view-marker:${props.id}`, { initialScratch: grab });
      }
      return null;
    },
    gateMarkers: (open) => {
      gate = open;
      return () => { if (gate === open) gate = null; };
    },
  };
}
