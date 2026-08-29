/**
 * `useInsertDepSource` — wires the `insert` dep consumed by `insertAction`.
 *
 * Provides kit-side kind→data factories for the 6 builtin shape kinds
 * (`rect`, `ellipse`, `line`, `polygon`, `star`, `pencil`). Acceptable because
 * these kinds are kit-shipped tools; a future phase can expose a
 * `nodeFactories` prop for consumer-defined kinds.
 *
 * `line`, `polygon`, `star` and `pencil` receive the drag AABB from the
 * insertAction invoker, but `extras` may carry richer geometry (endpoints,
 * center+radius+rotation, point trail). `insertPreviewExtent` resolves the
 * two into the node's real extent — the same resolution the live preview
 * and the reported gesture bounds use.
 */
import { useRef } from 'react';
import { useDepSource } from 'interactions/actions/depRegistry';
import type { InsertDep, InsertExtras } from 'interactions/actions/depSchema';
import type { Scene, NodeId } from 'core/scene/types';
import { asNodeId } from 'core/scene/types';
import type { Op } from 'core/ops/types';
import { createInsertOp } from 'core/ops/create';
import {
  rectPath,
  ellipsePath,
  regularPolygonPath,
  starPath,
  linePath,
  polygonFromPoints,
} from 'features/paths/builder';
import { schneiderFit } from 'features/paths/schneiderFit';
import { insertPreviewExtent } from '../insertPreviewExtent';
import { DEFAULT_PALETTE, solid, strokeOf } from '../../util/paint';

interface OpsApplier {
  applyOps(ops: Op[], label?: string): void;
}

/**
 * Consumer-supplied node factory for one insert `kind`. Given the drag AABB
 * and the tool's `extras`, returns the node's `data` (in the consumer's own
 * data shape) plus an optional `pose` override — the dep supplies id, layer,
 * and the undoable insert op. Return `null` to reject the insert.
 *
 * A factory registered for a kit kind (`rect`, `line`, …) fully replaces the
 * kit's default `{ path, fill }` factory for that kind; a factory for a novel
 * kind adds support the kit doesn't ship (e.g. `text`). See
 * `SceneCanvas`'s `insertNodeFactories` prop.
 */
export type InsertNodeFactory = (
  bounds: { x: number; y: number; width: number; height: number },
  extras: InsertExtras,
) => { data: unknown; pose?: unknown } | null;

export function useInsertDepSource(
  scene: Scene<unknown, string, unknown>,
  adapter: OpsApplier,
  factories?: Record<string, InsertNodeFactory>,
): void {
  const sceneRef = useRef(scene);
  sceneRef.current = scene;
  const adapterRef = useRef(adapter);
  adapterRef.current = adapter;
  const factoriesRef = useRef(factories);
  factoriesRef.current = factories;
  const insertSeqRef = useRef(0);

  useDepSource('insert', (): InsertDep => {
    const sc = sceneRef.current;
    const ad = adapterRef.current;

    return {
      commit(bounds, extras): NodeId | null {
        const kind = extras.kind;
        // Walk the seq counter forward until we land on an id that doesn't
        // already exist in the scene. Handles two cases:
        //   1. Fresh mount after localStorage rehydration — the scene starts
        //      with `kit-${kind}-1` etc. already populated; bare ++seq would
        //      collide on the first insert.
        //   2. Hot-reload re-mounts the hook with a reset counter.
        let seq = ++insertSeqRef.current;
        let id = asNodeId(`kit-${kind}-${seq}`);
        while (sc.get(id) !== undefined) {
          seq = ++insertSeqRef.current;
          id = asNodeId(`kit-${kind}-${seq}`);
        }
        const color = DEFAULT_PALETTE[seq % DEFAULT_PALETTE.length];
        const fill = solid(color);
        const layer = (sc.layers[0]?.id ?? 'default') as string;

        // The nascent node's extent — drag AABB reconciled with whatever
        // richer geometry `extras` carries.
        const extent = insertPreviewExtent({ shape: kind, bounds, extras });
        const pose: unknown = extent.bounds;

        // Consumer factory wins over the kit default for this kind (and is the
        // only way to insert consumer-defined kinds like `text`). It owns the
        // node's data + optional pose; the dep still supplies id/layer/op.
        const factory = factoriesRef.current?.[kind];
        if (factory) {
          const built = factory(bounds, extras);
          if (built === null) return null;
          ad.applyOps(
            [createInsertOp({ node: { id, kind: 'leaf', layer, pose: built.pose ?? pose, data: built.data } as unknown as { id: string }, label: `Insert ${kind}` })],
            `Insert ${kind}`,
          );
          return id;
        }

        const geom = extent.geometry;
        let data: unknown;

        switch (geom.kind) {
          case 'line':
            data = { path: linePath(geom.a, geom.b), fill, stroke: strokeOf(color, 2) };
            break;
          case 'polygon':
            data = {
              path: regularPolygonPath(geom.center, geom.radius, geom.sides, geom.rotation),
              fill,
            };
            break;
          case 'star':
            data = {
              path: starPath(geom.center, geom.outerRadius, geom.points, geom.innerRadius, geom.rotation),
              fill,
            };
            break;
          case 'pencil': {
            const samples = geom.samples as { x: number; y: number }[];
            if (samples.length >= 4) {
              data = { path: schneiderFit(samples, 2.0), stroke: strokeOf(color, 2) };
            } else if (samples.length >= 2) {
              data = { path: polygonFromPoints(samples), stroke: strokeOf(color, 2) };
            } else {
              data = { path: rectPath(0, 0, extent.bounds.width, extent.bounds.height), fill };
            }
            break;
          }
          case 'box':
            switch (kind) {
              case 'rect':
                // Geometry-in-local-frame: the rect path lives at the origin and
                // the pose carries position. `pathInPoseFrame` rebases a rect path
                // onto the pose box regardless of the stored coords, so origin vs.
                // duplicated-pose-coords render identically — don't double-count
                // the position. (#13)
                data = { path: rectPath(0, 0, extent.bounds.width, extent.bounds.height), fill };
                break;
              case 'ellipse':
                data = { path: ellipsePath(extent.bounds), fill };
                break;
              case 'text': {
                // The built-in `useTextTool` drags an empty text box you then type
                // into (edit is entered via `enterTextEdit`), so `extras` carries
                // no content and `text` defaults to `''`. The kit:text painter
                // matches on `data.text != null` and applies style defaults at
                // render time, so a bare `{ text }` is a complete, editable node.
                const e = extras as Partial<{ text: string }>;
                data = { text: e.text ?? '' };
                break;
              }
              case 'image': {
                // The bitmap is loaded + cached by `imageCache` keyed on `src`;
                // only the (serializable) `src` lives on the node.
                const e = extras as Partial<{ src: string; opacity: number }>;
                data = {
                  image: {
                    src: e.src ?? '',
                    ...(e.opacity !== undefined ? { opacity: e.opacity } : {}),
                  },
                };
                break;
              }
              default:
                console.warn(`weasel insertDep: no factory for kind="${kind}". Skipping insert.`);
                return null;
            }
            break;
        }

        ad.applyOps(
          [createInsertOp({ node: { id, kind: 'leaf', layer, pose, data } as unknown as { id: string }, label: `Insert ${kind}` })],
          `Insert ${kind}`,
        );
        return id;
      },
    };
  });
}
