/**
 * `useInsertDepSource` — wires the `insert` dep consumed by `insertAction`.
 *
 * Provides kit-side kind→data factories for the 6 builtin shape kinds
 * (`rect`, `ellipse`, `line`, `polygon`, `star`, `pencil`). Acceptable because
 * these kinds are kit-shipped tools; a future phase can expose a
 * `nodeFactories` prop for consumer-defined kinds.
 *
 * Trade-off: `line`, `polygon`, and `star` receive AABB bounds from the
 * insertAction invoker, but `extras` may carry richer geometry (endpoints,
 * center+radius+rotation, point trail) which we prefer when present.
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
import { DEFAULT_PALETTE } from '../../util/paint';

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
        const fill = DEFAULT_PALETTE[seq % DEFAULT_PALETTE.length];
        const layer = (sc.layers[0]?.id ?? 'default') as string;

        // Consumer factory wins over the kit default for this kind (and is the
        // only way to insert consumer-defined kinds like `text`). It owns the
        // node's data + optional pose; the dep still supplies id/layer/op.
        const factory = factoriesRef.current?.[kind];
        if (factory) {
          const built = factory(bounds, extras);
          if (built === null) return null;
          const factoredPose = built.pose ??
            { x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height };
          ad.applyOps(
            [createInsertOp({ node: { id, kind: 'leaf', layer, pose: factoredPose, data: built.data } as unknown as { id: string }, label: `Insert ${kind}` })],
            `Insert ${kind}`,
          );
          return id;
        }

        let data: unknown;
        let pose: unknown = { x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height };

        switch (kind) {
          case 'rect':
            // Geometry-in-local-frame: the rect path lives at the origin and the
            // pose carries position (`pose = {x: bounds.x, y: bounds.y, …}` above).
            // The renderer's `pathInPoseFrame` rebases a rect path onto the pose box
            // regardless of the stored coords, so origin vs. duplicated-pose-coords
            // render/hit-test identically — don't double-count the position. (#13)
            data = { path: rectPath(0, 0, bounds.width, bounds.height), fill };
            break;
          case 'ellipse':
            data = { path: ellipsePath(bounds), fill };
            break;
          case 'line': {
            const e = extras as Partial<{ a: { x: number; y: number }; b: { x: number; y: number } }>;
            const a = e.a ?? { x: bounds.x, y: bounds.y };
            const b = e.b ?? { x: bounds.x + bounds.width, y: bounds.y + bounds.height };
            data = { path: linePath(a, b), fill, stroke: fill, strokeWidth: 2 };
            break;
          }
          case 'polygon': {
            const e = extras as Partial<{
              sides: number; rotation: number;
              center: { x: number; y: number }; radius: number;
            }>;
            const sides = Math.max(3, Math.floor(e.sides ?? 6));
            const rotation = e.rotation ?? 0;
            const cx = e.center?.x ?? bounds.x + bounds.width / 2;
            const cy = e.center?.y ?? bounds.y + bounds.height / 2;
            const r = e.radius ?? Math.min(bounds.width, bounds.height) / 2;
            data = { path: regularPolygonPath({ x: cx, y: cy }, r, sides, rotation), fill };
            pose = { x: cx - r, y: cy - r, width: r * 2, height: r * 2 };
            break;
          }
          case 'star': {
            const e = extras as Partial<{
              points: number; innerRadiusRatio: number; rotation: number;
              center: { x: number; y: number }; outerRadius: number;
            }>;
            const points = Math.max(3, Math.floor(e.points ?? 5));
            const ratio = e.innerRadiusRatio ?? 0.5;
            const rotation = e.rotation ?? 0;
            const cx = e.center?.x ?? bounds.x + bounds.width / 2;
            const cy = e.center?.y ?? bounds.y + bounds.height / 2;
            const outerR = e.outerRadius ?? Math.min(bounds.width, bounds.height) / 2;
            const innerR = outerR * ratio;
            data = { path: starPath({ x: cx, y: cy }, outerR, points, innerR, rotation), fill };
            pose = { x: cx - outerR, y: cy - outerR, width: outerR * 2, height: outerR * 2 };
            break;
          }
          case 'pencil': {
            const e = extras as Partial<{ samples: ReadonlyArray<{ x: number; y: number }> }>;
            const samples = e.samples ?? [];
            if (samples.length >= 4) {
              data = {
                path: schneiderFit(samples as { x: number; y: number }[], 2.0),
                stroke: fill, strokeWidth: 2,
              };
              let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
              for (const s of samples) {
                if (s.x < minX) minX = s.x;
                if (s.y < minY) minY = s.y;
                if (s.x > maxX) maxX = s.x;
                if (s.y > maxY) maxY = s.y;
              }
              pose = { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
            } else if (samples.length >= 2) {
              data = {
                path: polygonFromPoints(samples as { x: number; y: number }[]),
                stroke: fill, strokeWidth: 2,
              };
            } else {
              // Origin rect; pose (set above) carries position. See the 'rect'
              // case for why duplicating bounds.x/y into the path is redundant. (#13)
              data = { path: rectPath(0, 0, bounds.width, bounds.height), fill };
            }
            break;
          }
          case 'text': {
            // The built-in `useTextTool` drags an empty text box you then
            // type into (edit is entered via `enterTextEdit`), so `extras`
            // carries no content and `text` defaults to `''`. An ambient
            // ingest (e.g. a future `text/plain` handler) may pass `text`.
            // The kit:text painter matches on `data.text != null`, and style
            // defaults (fontSize 16, `#000`) are applied at render time, so a
            // bare `{ text }` is a complete, editable node. Pose = drag bounds.
            const e = extras as Partial<{ text: string }>;
            data = { text: e.text ?? '' };
            break;
          }
          case 'image': {
            // `src` rides along on the binding params (set by `useImageTool`).
            // The bitmap is loaded + cached by `imageCache` keyed on `src`;
            // only the (serializable) `src` lives on the node. Pose carries
            // position + size from the drawn bounds (set above).
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

        ad.applyOps(
          [createInsertOp({ node: { id, kind: 'leaf', layer, pose, data } as unknown as { id: string }, label: `Insert ${kind}` })],
          `Insert ${kind}`,
        );
        return id;
      },
    };
  });
}
