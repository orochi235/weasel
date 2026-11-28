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
  /** Returns an unregister. `props` is read at every draw, but its `target` only
   *  here: a retargeted marker registers again. A marker whose id an earlier one
   *  holds, at registration or after its `props` change, logs an error and is
   *  skipped until that marker leaves or changes id. */
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
  /** Markers already reported for a taken id, so a skipped one logs once. */
  const reported = new WeakSet<() => ViewMarkerProps>();
  const report = (props: () => ViewMarkerProps, id: string): void => {
    if (reported.has(props)) return;
    reported.add(props);
    console.error(`[weasel] registerMarker: marker "${id}" is already on this surface, so this one is skipped until that one goes away. Marker ids are unique per surface; rename one.`);
  };
  /** The markers drawn and hit, in mount order: the first to hold an id; later ones wait for it. */
  const live = (): { props: ViewMarkerProps; layer: RenderLayer<unknown>; registered: string | null }[] => {
    const held = new Set<string>();
    const out: { props: ViewMarkerProps; layer: RenderLayer<unknown>; registered: string | null }[] = [];
    for (const [thunk, { layer, target }] of markers) {
      const props = thunk();
      if (held.has(props.id)) { report(thunk, props.id); continue; }
      held.add(props.id);
      reported.delete(thunk);
      out.push({ props, layer, registered: target });
    }
    return out;
  };
  return {
    registerMarker: (props) => {
      const { id } = props();
      for (const held of markers.keys()) if (held().id === id) report(props, id);
      markers.set(props, { layer: createViewMarkerLayer(props, deps.host), target: props().target });
      deps.changed();
      return () => { if (markers.delete(props)) deps.changed(); };
    },
    markerLayers: (target) => live().filter((m) => m.registered === target).map((m) => m.layer),
    markerAt: (target, world) => {
      if (!gate?.()) return null;
      const space = targetSpace(target);
      const at = space?.project(world);
      if (!space || !at) return null;
      const drawn = live();
      for (let i = drawn.length - 1; i >= 0; i--) {
        const { props, registered } = drawn[i]!;
        if (registered !== target) continue;
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
