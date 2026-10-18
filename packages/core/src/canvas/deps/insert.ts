/**
 * `useInsertDepSource` — wires the `insert` dep consumed by `insertAction`.
 *
 * `line`, `polygon`, `star`, and `pencil` receive the drag AABB from the insertAction invoker,
 * but `extras` may carry richer geometry (endpoints, center+radius+rotation, point trail).
 * `insertPreviewExtent` resolves the two into the node's real extent — the same resolution the
 * live preview and the reported gesture bounds use.
 */
import { useRef } from 'react';
import { useDepRegistry, useDepSource } from '@weasel-js/routing/react';
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
import type { ShapeGenerator } from 'features/paths/shapeGenerator';
import type { Stroke, Fill } from '@weasel-js/paint';
import { cycleFill, solid, strokeOf } from '../../util/paint';
import { composesFrames, composeWorldPose } from 'core/scene/composeFrame';
import { definesFrame } from 'core/scene/effectivePose';
import { stickyData, type StickyStyle } from '../../tools/builtin/sticky/stickyNode';

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
 * trail too short to fit is built as a rect and asks as one. A line and an
 * open pen path are inserted unfilled: a fill given to either is dropped.
 * `fillRule` is the rule a path that carries one is built with, where the
 * kit's own is nonzero; a rect or an ellipse has none to set.
 *
 * It paints only the shapes the kit builds: an `InsertNodeFactory` owns its
 * node's whole `data`. See `SceneCanvas`'s `insertPaint` prop.
 */
export type InsertPaint = (kind: string, seq: number) => {
  fill?: Fill | null;
  stroke?: Stroke | null;
  fillRule?: PathFillRule;
};

function paintKeys({ fill, stroke }: ReturnType<InsertPaint>): { fill?: Fill | null; stroke?: Stroke | null } {
  return { ...(fill !== undefined ? { fill } : {}), ...(stroke !== undefined ? { stroke } : {}) };
}

function withFillRule(data: unknown, rule: PathFillRule | undefined): unknown {
  const path = (data as { path?: object } | undefined)?.path;
  if (rule === undefined || path === undefined || !('fillRule' in path)) return data;
  return { ...(data as object), path: { ...path, fillRule: rule } };
}

/** The default {@link InsertPaint}: the next color of the kit palette, as a
 *  fill on a closed shape, a fill and a stroke on a pen path, and a stroke
 *  alone on a line or a pencil trail. */
export const paletteInsertPaint: InsertPaint = (kind, seq) => {
  const color = cycleFill(seq);
  if (kind === 'line' || kind === 'pencil') return { stroke: strokeOf(color, 2) };
  if (kind === 'path') return { fill: { paint: solid(color) }, stroke: strokeOf(color, 2) };
  return { fill: { paint: solid(color) } };
};

/** The kit's default data for a kind drawn as a box, or `null` for a kind it has none for. */
function boxKindData(
  kind: string,
  bounds: { x: number; y: number; width: number; height: number },
  extras: InsertExtras,
  painted: (as?: string) => ReturnType<typeof paintKeys>,
): unknown {
  switch (kind) {
    case 'rect':
      // The rect path lives at the origin and the pose carries position:
      // `pathInPoseFrame` rebases a rect path onto the pose box, so don't
      // double-count the position.
      return { path: rectPath(0, 0, bounds.width, bounds.height), ...painted() };
    case 'ellipse':
      return { path: ellipsePath(bounds), ...painted() };
    case 'path': {
      const e = extras as { path: PolygonPath; closed: boolean; data?: Readonly<Record<string, unknown>> };
      return { ...e.data, path: e.path, ...painted(), ...(e.closed ? {} : { fill: null }) };
    }
    case 'text': {
      // The built-in text tool drags an empty text box you then type into, so
      // `extras` carries no content. The kit:text painter matches on
      // `data.text != null` and applies style defaults at render time, so a bare
      // `{ text }` is a complete, editable node.
      const e = extras as Partial<{ text: string }>;
      return { text: e.text ?? '' };
    }
    case 'sticky':
      return stickyData(extras as StickyStyle & { text?: string });
    case 'image': {
      // The bitmap is loaded + cached by `imageCache` keyed on `src`;
      // only the (serializable) `src` lives on the node.
      const e = extras as Partial<{ src: string; opacity: number }>;
      return { image: { src: e.src ?? '', ...(e.opacity !== undefined ? { opacity: e.opacity } : {}) } };
    }
    default:
      return null;
  }
}

/**
 * Where an insert lands: the container the `insertInto` dep names, on that container's
 * layer, with the pose made local to it when the scene composes frames —
 * or the top of the tree, on the first layer, when it names no container.
 */
function insertSite(
  sc: Scene<unknown, string, unknown>,
  into: string | null | undefined,
): { parent: NodeId | null; layer: string; local: (world: unknown) => unknown } {
  const parent = into == null ? undefined : sc.get(into as NodeId);
  if (parent === undefined || parent.kind !== 'container') {
    return { parent: null, layer: (sc.layers[0]?.id ?? 'default') as string, local: (p) => p };
  }
  const composition = sc.composition;
  if (composition === undefined || !composesFrames(composition)) {
    return { parent: parent.id, layer: parent.layer, local: (p) => p };
  }
  const frame = composeWorldPose({
    getPose: (id) => sc.get(id as NodeId)!.pose,
    getParent: (id) => sc.get(id as NodeId)?.parent ?? null,
    definesFrame: (id) => definesFrame(sc.get(id as NodeId) ?? {}),
  }, parent.id, composition.compose);
  return { parent: parent.id, layer: parent.layer, local: (p) => composition.decompose(frame, p) };
}

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
  const registry = useDepRegistry();
  const insertSeqRef = useRef(0);
  const liveRef = useRef<InsertLive>({ gesture: null });
  useDepSource('insertLive', () => liveRef.current);

  useDepSource('insert', (): InsertDep => {
    const sc = sceneRef.current;
    const ad = adapterRef.current;

    const site = () => insertSite(sc, registry.get('insertInto')?.get());
    const build = (
      bounds: { x: number; y: number; width: number; height: number },
      extras: InsertExtras,
    ): { id: NodeId; ops: Op[] } | null => {
        const kind = extras.kind;
        const { parent, layer, local } = site();
        const seq = ++insertSeqRef.current;
        const id = sc.mintId();
        let asked: ReturnType<InsertPaint> | undefined;
        const painted = (as: string = kind) => paintKeys(asked = paintRef.current(as, seq));

        // The nascent node's extent — drag AABB reconciled with whatever
        // richer geometry `extras` carries.
        const extent = insertPreviewExtent({ shape: kind, bounds, extras });
        const pose: unknown = extent.bounds;

        // Consumer factory wins over the kit default for this kind. It owns the node's
        // data + optional pose; the dep still supplies id/layer/op.
        const factory = factoriesRef.current?.[kind];
        if (factory) {
          const built = factory(bounds, extras);
          if (built === null) return null;
          return {
            id,
            ops: [createInsertOp({ node: { id, kind: 'leaf', layer, parent, pose: local(built.pose ?? pose), data: built.data } as unknown as { id: string }, label: `Insert ${kind}` })],
          };
        }

        const geom = extent.geometry;
        let data: unknown;

        switch (geom.kind) {
          case 'line':
            data = { path: linePath(geom.a, geom.b), ...painted(), fill: null };
            break;
          case 'polygon':
            data = {
              path: regularPolygonPath(geom.center, geom.radius, geom.sides, geom.rotation),
              generator: { kind: 'polygon', sides: geom.sides, rotation: geom.rotation } satisfies ShapeGenerator,
              ...painted(),
            };
            break;
          case 'star':
            data = {
              path: starPath(geom.center, geom.outerRadius, geom.points, geom.innerRadius, geom.rotation),
              generator: {
                kind: 'star',
                points: geom.points,
                innerRadiusRatio: geom.outerRadius === 0 ? 0.5 : geom.innerRadius / geom.outerRadius,
                rotation: geom.rotation,
              } satisfies ShapeGenerator,
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
            data = boxKindData(kind, extent.bounds, extras, painted);
            if (data === null) {
              console.warn(`weasel insertDep: no factory for kind="${kind}". Skipping insert.`);
              return null;
            }
            break;
        }

        data = withFillRule(data, asked?.fillRule);
        return {
          id,
          ops: [createInsertOp({ node: { id, kind: 'leaf', layer, parent, pose: local(pose), data } as unknown as { id: string }, label: `Insert ${kind}` })],
        };
    };
    return {
      layer: () => site().layer,
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
