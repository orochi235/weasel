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
import { useDepSource } from '@weasel-js/routing/react';
import { useLatest } from '@weasel-js/react';
import type { InsertDep, InsertExtras, InsertLive } from 'interactions/actions/depSchema';
import type { Scene, NodeId } from 'core/scene/types';
import type { Op } from 'core/ops/types';
import { createInsertOp } from 'core/ops/create';
import {
  rectPath,
  ellipsePath,
  regularPolygonPath,
  starPath,
  linePath,
  polygonFromPoints,
  schneiderFit,
  type PathFillRule,
  type PolygonPath,
} from '@weasel-js/geom';
import { insertPreviewExtent } from '../insertPreviewExtent';
import type { FillStyle, Stroke } from '@weasel-js/paint';
import { cycleFill, solid, strokeOf } from '../../util/paint';

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
 * kind adds support the kit doesn't ship (e.g. `text`). To change only the
 * paint of a kit shape, pass an {@link InsertPaint}. See
 * `SceneCanvas`'s `insertNodeFactories` prop.
 */
export type InsertNodeFactory = (
  bounds: { x: number; y: number; width: number; height: number },
  extras: InsertExtras,
) => { data: unknown; pose?: unknown } | null;

/**
 * The paint a kit-built shape is inserted with. `kind` is the shape being
 * built and `seq` counts this canvas's inserts from 1. A key left out stays
 * off the node, so its painter's default applies; `null` is "none". A pencil
 * trail too short to fit is built as a rect and asks as one. `fillRule` is
 * the rule a path that carries one is built with, where the kit's own is
 * nonzero; a rect or an ellipse has none to set.
 *
 * It paints only the shapes the kit builds: an `InsertNodeFactory` owns its
 * node's whole `data`. See `SceneCanvas`'s `insertPaint` prop.
 */
export type InsertPaint = (kind: string, seq: number) => {
  fill?: FillStyle | null;
  stroke?: Stroke | null;
  fillRule?: PathFillRule;
};

function paintKeys({ fill, stroke }: ReturnType<InsertPaint>): { fill?: FillStyle | null; stroke?: Stroke | null } {
  return { ...(fill !== undefined ? { fill } : {}), ...(stroke !== undefined ? { stroke } : {}) };
}

function withFillRule(data: unknown, rule: PathFillRule | undefined): unknown {
  const path = (data as { path?: object } | undefined)?.path;
  if (rule === undefined || path === undefined || !('fillRule' in path)) return data;
  return { ...(data as object), path: { ...path, fillRule: rule } };
}

/** The default {@link InsertPaint}: the next color of the kit palette, as a
 *  fill on a closed shape, a fill and a stroke on a line or a pen path, and a
 *  stroke alone on a pencil trail. */
export const paletteInsertPaint: InsertPaint = (kind, seq) => {
  const color = cycleFill(seq);
  if (kind === 'pencil') return { stroke: strokeOf(color, 2) };
  if (kind === 'line' || kind === 'path') return { fill: solid(color), stroke: strokeOf(color, 2) };
  return { fill: solid(color) };
};

export function useInsertDepSource(
  scene: Scene<unknown, string, unknown>,
  adapter: OpsApplier,
  factories?: Record<string, InsertNodeFactory>,
  paint: InsertPaint = paletteInsertPaint,
): void {
  const sceneRef = useLatest(scene);
  const adapterRef = useLatest(adapter);
  const factoriesRef = useLatest(factories);
  const paintRef = useLatest(paint);
  const insertSeqRef = useRef(0);
  const liveRef = useRef<InsertLive>({ gesture: null });
  useDepSource('insertLive', () => liveRef.current);

  useDepSource('insert', (): InsertDep => {
    const sc = sceneRef.current;
    const ad = adapterRef.current;

    const layer = (sc.layers[0]?.id ?? 'default') as string;
    const build = (
      bounds: { x: number; y: number; width: number; height: number },
      extras: InsertExtras,
    ): { id: NodeId; ops: Op[] } | null => {
        const kind = extras.kind;
        const seq = ++insertSeqRef.current;
        const id = sc.mintId();
        let asked: ReturnType<InsertPaint> | undefined;
        const painted = (as: string = kind) => paintKeys(asked = paintRef.current(as, seq));

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
          return {
            id,
            ops: [createInsertOp({ node: { id, kind: 'leaf', layer, pose: built.pose ?? pose, data: built.data } as unknown as { id: string }, label: `Insert ${kind}` })],
          };
        }

        const geom = extent.geometry;
        let data: unknown;

        switch (geom.kind) {
          case 'line':
            data = { path: linePath(geom.a, geom.b), ...painted() };
            break;
          case 'polygon':
            data = {
              path: regularPolygonPath(geom.center, geom.radius, geom.sides, geom.rotation),
              ...painted(),
            };
            break;
          case 'star':
            data = {
              path: starPath(geom.center, geom.outerRadius, geom.points, geom.innerRadius, geom.rotation),
              ...painted(),
            };
            break;
          case 'pencil': {
            const samples = geom.samples as { x: number; y: number }[];
            if (samples.length >= 4) {
              data = { path: schneiderFit(samples, 2.0), ...painted() };
            } else if (samples.length >= 2) {
              data = { path: polygonFromPoints(samples), ...painted() };
            } else {
              data = { path: rectPath(0, 0, extent.bounds.width, extent.bounds.height), ...painted('rect') };
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
                data = { path: rectPath(0, 0, extent.bounds.width, extent.bounds.height), ...painted() };
                break;
              case 'ellipse':
                data = { path: ellipsePath(extent.bounds), ...painted() };
                break;
              case 'path': {
                const e = extras as { path: PolygonPath; closed: boolean };
                data = { path: e.path, ...painted(), ...(e.closed ? {} : { fill: null }) };
                break;
              }
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

        data = withFillRule(data, asked?.fillRule);
        return {
          id,
          ops: [createInsertOp({ node: { id, kind: 'leaf', layer, pose, data } as unknown as { id: string }, label: `Insert ${kind}` })],
        };
    };
    return {
      layer: () => layer,
      build,
      commit(bounds, extras): NodeId | null {
        const built = build(bounds, extras);
        if (built === null) return null;
        ad.applyOps(built.ops, `Insert ${extras.kind}`);
        return built.id;
      },
    };
  });
}
