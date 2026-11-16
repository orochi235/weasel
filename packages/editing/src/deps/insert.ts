/**
 * `useInsertDepSource` — wires the `insert` dep consumed by `insertAction`.
 *
 * `line`, `polygon`, `star`, and `pencil` receive the drag AABB from the insertAction invoker,
 * but `extras` may carry richer geometry (endpoints, center+radius+rotation, point trail).
 * `insertPreviewExtent` resolves the two into the node's real extent — the same resolution the
 * live preview and the reported gesture bounds use.
 */
import { getOwn } from '@weasel-js/registry';
import { useRef } from 'react';
import { useDepRegistry, useDepSource } from '@weasel-js/routing/react';
import { useLatest } from '@weasel-js/react';
import type { InsertDep, InsertEnds, InsertExtras, InsertLive, ShapeGenerator } from '@weasel-js/core/engine';
import { insertSite, cycleFill, solid, strokeOf, strokeWith, minSizeOf } from '@weasel-js/core';
import { poseDescriptorOf, createInsertOp, commitSelectionOps, insertPreviewExtent } from '@weasel-js/core/engine';
import type { Scene, NodeId, OpsApplier, Op, InsertNodeFactories, InsertedNode } from '@weasel-js/core';
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
import type { Stroke, Fill } from '@weasel-js/paint';
import { DEFAULT_STROKE_WIDTH, type InsertStyle } from '../actions/insert/style';

type Hooks = Pick<InsertedNode, 'batch' | 'inserted'>;

interface Painted { fill?: Fill | null; stroke?: Stroke | null }

/** The paint a kit-built shape of `kind` is inserted with: its `style`, or for
 *  an insert carrying none (a tool declaring no style options), the next color
 *  of the kit palette, as a fill on a closed shape, a fill and a stroke on a
 *  pen path, and a stroke alone on a line or a pencil trail. A key the style
 *  leaves out stays off the node, which paints none of it. `seq` counts this
 *  canvas's inserts from 1. */
function paintOf(kind: string, style: InsertStyle | undefined, seq: number): Painted {
  if (!style) {
    const color = cycleFill(seq);
    if (kind === 'line' || kind === 'pencil') return { stroke: strokeOf(color, DEFAULT_STROKE_WIDTH) };
    if (kind === 'path') return { fill: { paint: solid(color) }, stroke: strokeOf(color, DEFAULT_STROKE_WIDTH) };
    return { fill: { paint: solid(color) } };
  }
  const out: Painted = {};
  if (style.fill !== undefined) out.fill = style.fill === null ? null : { paint: style.fill };
  if (style.stroke !== undefined) {
    out.stroke = style.stroke === null ? null : strokeWith(style.stroke, style.strokeWidth ?? DEFAULT_STROKE_WIDTH);
  }
  return out;
}

function withFillRule(data: unknown, rule: PathFillRule | undefined): unknown {
  const path = (data as { path?: object } | undefined)?.path;
  if (rule === undefined || path === undefined || !('fillRule' in path)) return data;
  return { ...(data as object), path: { ...path, fillRule: rule } };
}

/** The kinds {@link kitData} builds a node for with no factory. */
export const KIT_INSERT_KINDS: readonly string[] = Object.freeze([
  'rect', 'ellipse', 'line', 'polygon', 'star', 'path', 'pencil', 'image',
]);


/** The kit's default data for a kind drawn as a box, or `null` for a kind it has none for. */
function boxKindData(
  kind: string,
  bounds: { x: number; y: number; width: number; height: number },
  extras: InsertExtras,
  painted: (as?: string) => Painted,
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

/** The data the kit builds for an insert of `kind` filling `extent`, or `null`
 *  for a box kind it has none for. */
function kitData(
  kind: string,
  extent: ReturnType<typeof insertPreviewExtent>,
  extras: InsertExtras,
  painted: (as?: string) => Painted,
): unknown {
  const geom = extent.geometry;
  switch (geom.kind) {
    case 'line':
      return { path: linePath(geom.a, geom.b), ...painted(), fill: null };
    case 'polygon':
      return {
        path: regularPolygonPath(geom.center, geom.radius, geom.sides, geom.rotation),
        generator: { kind: 'polygon', sides: geom.sides, rotation: geom.rotation } satisfies ShapeGenerator,
        ...painted(),
      };
    case 'star':
      return {
        path: starPath(geom.center, geom.outerRadius, geom.points, geom.innerRadius, geom.rotation),
        generator: {
          kind: 'star',
          points: geom.points,
          innerRadiusRatio: geom.outerRadius === 0 ? 0.5 : geom.innerRadius / geom.outerRadius,
          rotation: geom.rotation,
        } satisfies ShapeGenerator,
        ...painted(),
      };
    case 'pencil': {
      const samples = geom.samples as { x: number; y: number }[];
      if (samples.length >= 4) return { path: schneiderFit(samples, 2.0), ...painted() };
      if (samples.length >= 2) return { path: polygonFromPoints(samples), ...painted() };
      return { path: rectPath(0, 0, extent.bounds.width, extent.bounds.height), ...painted('rect') };
    }
    case 'box':
      return boxKindData(kind, extent.bounds, extras, painted);
    default:
      return null;
  }
}

/** Provides the `insert` dep, and the `insertLive` gesture state beside it, minting nodes into `scene` through
 *  `adapter` with `factories` in place of the kit's own. */
export function useInsertDepSource(
  scene: Scene<unknown, string, unknown>,
  adapter: OpsApplier,
  factories?: InsertNodeFactories,
): void {
  const sceneRef = useLatest(scene);
  const adapterRef = useLatest(adapter);
  const factoriesRef = useLatest(factories);
  const registry = useDepRegistry();
  const insertSeqRef = useRef(0);
  const liveRef = useRef<InsertLive>({ gesture: null });
  useDepSource('insertLive', () => liveRef.current);

  useDepSource('insert', (): InsertDep => {
    const sc = sceneRef.current;
    const ad = adapterRef.current;

    const site = (at?: { x: number; y: number }) =>
      insertSite(sc, {
        at, into: registry.get('insertInto')?.get(), canDropInto: registry.get('canDropInto'),
        descriptor: poseDescriptorOf(registry.get('poseDescriptor')),
      });
    /** The node an insert numbered `seq` makes, with nothing minted or counted. A peek is quiet. */
    const nodeFor = (
      bounds: Parameters<NonNullable<InsertDep['build']>>[0],
      extras: InsertExtras,
      ends: InsertEnds | undefined,
      seq: number,
      quiet = false,
    ): ({ parent: NodeId | null; layer: string; pose: unknown; data: unknown } & Hooks) | null => {
        const kind = extras.kind;
        const { parent, layer, local } = site(ends?.start ?? { x: bounds.x, y: bounds.y });
        const style = (extras as { style?: InsertStyle }).style;
        const painted = (as: string = kind) => paintOf(as, style, seq);

        // The nascent node's extent — drag AABB reconciled with whatever
        // richer geometry `extras` carries.
        const extent = insertPreviewExtent({ shape: kind, bounds, extras });
        const pose: unknown = extent.bounds;

        // Consumer factory wins over the kit default for this kind. It owns the node's
        // data + optional pose; the dep still supplies id/layer/op.
        const factories = factoriesRef.current;
        const factory = factories ? getOwn(factories, kind) : undefined;
        if (factory) {
          const built = factory(bounds, extras);
          if (built === null) return null;
          return { parent, layer, pose: local(built.pose ?? pose), data: built.data, batch: built.batch, inserted: built.inserted };
        }

        let data = kitData(kind, extent, extras, painted);
        if (data === null) {
          if (!quiet) {
            console.warn(
              `weasel insertDep: no factory for kind="${kind}", so nothing was inserted. ` +
              `Give <SceneCanvas insertNodeFactories={{ '${kind}': (bounds, extras) => ({ data }) }}> one.`,
            );
          }
          return null;
        }
        data = withFillRule(data, style?.fillRule);
        const min = minSizeOf(extras);
        if (min) data = { ...(data as object), minSize: min };
        return { parent, layer, pose: local(pose), data };
    };
    const make = (...args: Parameters<NonNullable<InsertDep['build']>>): ({ id: NodeId; ops: Op[] } & Hooks) | null => {
      const [bounds, extras, ends] = args;
      const made = nodeFor(bounds, extras, ends, ++insertSeqRef.current);
      if (made === null) return null;
      const { batch, inserted, ...node } = made;
      const id = sc.mintId();
      return {
        id, batch, inserted,
        ops: [createInsertOp({ node: { id, kind: 'mark', ...node } as unknown as { id: string }, label: `Insert ${extras.kind}` })],
      };
    };
    const build: NonNullable<InsertDep['build']> = (...args) => {
      const made = make(...args);
      return made && { id: made.id, ops: made.ops };
    };
    return {
      layer: () => site().layer,
      build,
      peek(bounds, extras, ends) {
        const node = nodeFor(bounds, extras, ends, insertSeqRef.current + 1, true);
        return node && { data: node.data, pose: node.pose };
      },
      commit(bounds, extras, ends, select): NodeId | null {
        const built = make(bounds, extras, ends);
        if (built === null) return null;
        const label = `Insert ${extras.kind}`;
        const apply = () => ad.applyOps([...built.ops, ...commitSelectionOps(select, built.id, label)], label);
        // An adapter whose `applyOps` keeps its own history records nothing in the batch.
        if (built.batch) sc.batch(label, apply, built.batch(String(built.id)));
        else apply();
        built.inserted?.(String(built.id), registry);
        return built.id;
      },
    };
  });
}
