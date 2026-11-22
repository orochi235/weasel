import {
  type ActionsRegistry,
  type AffordanceHit,
  type DepName,
  type DepSource,
  layerAffordance,
  type SurfaceContribution,
  useOptionalDepRegistry,
  type ViewApi,
} from '@weasel-js/core';
import { type RefObject, useEffect, useMemo } from 'react';
import { hostBox } from './hostBox';

const NO_ENTRIES: ReadonlyMap<string, SurfaceContribution> = new Map();

/** What {@link useCameraContributions} hands the camera's dispatcher. */
export interface CameraContributionRouting {
  entriesById: ReadonlyMap<string, SurfaceContribution>;
  /** The topmost layer claim under a world point; absent with no layer that hit-tests. */
  affordanceAt?: (world: { x: number; y: number }) => AffordanceHit | null;
}

/**
 * Install `contributions`' input roles on a camera: each one's actions in `registry`, its deps in the dep registry
 * in scope, its bindings in the dispatcher's entries, and its layers' `hitTest`s as the affordances those bindings
 * target, the last registered hit first, in the camera's frame-local world. A camera draws nothing, so the layers'
 * painting, `attach`, the frame hooks, overlays, views, markers and menus are left alone.
 */
export function useCameraContributions(
  contributions: readonly SurfaceContribution[] | undefined,
  registry: ActionsRegistry,
  camera: ViewApi,
  hostRef: RefObject<HTMLElement | null>,
): CameraContributionRouting {
  const depRegistry = useOptionalDepRegistry();

  useEffect(() => {
    if (!contributions) return;
    const offs = contributions.flatMap((c) => (c.actions ?? []).map((a) => registry.register(a)));
    return () => {
      for (const off of offs) off();
    };
  }, [contributions, registry]);

  useEffect(() => {
    if (!contributions || !depRegistry) return;
    const offs = contributions.flatMap((c) =>
      Object.entries(c.deps ?? {}).map(([name, source]) =>
        depRegistry.register(name as DepName, source as DepSource<DepName>),
      ),
    );
    return () => {
      for (const off of offs) off();
    };
  }, [contributions, depRegistry]);

  return useMemo(() => {
    if (!contributions || contributions.length === 0) return { entriesById: NO_ENTRIES };
    const entriesById = new Map(contributions.map((c) => [c.id, c]));
    const hitLayers = contributions.flatMap((c) => c.layers ?? []).filter((l) => l.hitTest);
    if (hitLayers.length === 0) return { entriesById };
    hitLayers.reverse();
    return {
      entriesById,
      affordanceAt: (world) => {
        const box = hostBox(hostRef.current);
        const dims = { width: box?.width ?? 0, height: box?.height ?? 0 };
        const view = camera.get();
        for (const layer of hitLayers) {
          const claim = layer.hitTest?.(world.x, world.y, undefined, view, dims);
          if (claim) return layerAffordance(layer.id, claim);
        }
        return null;
      },
    };
  }, [contributions, camera, hostRef]);
}
