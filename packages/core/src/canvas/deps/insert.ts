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
import type { InsertDep, InsertEnds, InsertExtras, InsertLive } from 'interactions/actions/depSchema';
import { insertSite } from './insertSite';
import { poseDescriptorOf } from 'interactions/actions/poseDescriptorDep';
import type { Scene, NodeId } from 'core/scene/types';
import type { Op } from 'core/ops/types';
import { createInsertOp } from 'core/ops/create';
import { commitSelectionOps } from 'interactions/actions/defaultCommitAdapter';
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
import type { ShapeGenerator } from 'domains/paths/shapeGenerator';
import type { Stroke, Fill } from '@weasel-js/paint';
import { DEFAULT_TEXT_FILL } from '@weasel-js/text';
import { cycleFill, solid, strokeOf, strokeWith } from '../../util/paint';
import { DEFAULT_STROKE_WIDTH, type InsertStyle } from 'interactions/actions/insert/style';
import { stickyData, type StickyLook } from '../../tools/builtin/sticky/stickyNode';
import { minSizeOf } from 'core/scene/minSize';
import { shapeKindInfo } from 'core/shapeKinds';
import { textEditJoin } from 'domains/text/sceneTextDrafts';

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
 * kind adds support the kit doesn't ship (e.g. `text`). The paint of a kit
 * shape comes from the insert's `extras.style`: its tool's style options. See
 * `SceneCanvas`'s `insertNodeFactories` prop. It is also asked on every frame
 * of an insert's drag, inserting nothing, so a preview can show where the
 * scene's quantize rule lands the node: it must not count or mint anything.
 */
export type InsertNodeFactory = (
  bounds: { x: number; y: number; width: number; height: number },
  extras: InsertExtras,
) => { data: unknown; pose?: unknown } | null;

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
    case 'text': {
      // The built-in text tool drags an empty text box you then type into, so
      // `extras` carries no content. The kit:text painter matches on
      // `data.text != null` and applies style defaults at render time.
      const e = extras as Partial<{ text: string; style: InsertStyle }>;
      const fill = e.style?.fill;
      return { text: e.text ?? '', fill: fill === undefined ? DEFAULT_TEXT_FILL : fill && { paint: fill } };
    }
    case 'sticky':
      return stickyData(extras as StickyLook & { text?: string });
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

export function useInsertDepSource(
  scene: Scene<unknown, string, unknown>,
  adapter: OpsApplier,
  factories?: Record<string, InsertNodeFactory>,
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
    ): { parent: NodeId | null; layer: string; pose: unknown; data: unknown } | null => {
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
        const factory = factoriesRef.current?.[kind];
        if (factory) {
          const built = factory(bounds, extras);
          return built === null ? null : { parent, layer, pose: local(built.pose ?? pose), data: built.data };
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
    const build: NonNullable<InsertDep['build']> = (bounds, extras, ends) => {
      const node = nodeFor(bounds, extras, ends, ++insertSeqRef.current);
      if (node === null) return null;
      const id = sc.mintId();
      return { id, ops: [createInsertOp({ node: { id, kind: 'mark', ...node } as unknown as { id: string }, label: `Insert ${extras.kind}` })] };
    };
    return {
      layer: () => site().layer,
      build,
      peek(bounds, extras, ends) {
        const node = nodeFor(bounds, extras, ends, insertSeqRef.current + 1, true);
        return node && { data: node.data, pose: node.pose };
      },
      commit(bounds, extras, ends, select): NodeId | null {
        const built = build(bounds, extras, ends);
        if (built === null) return null;
        const label = `Insert ${extras.kind}`;
        const apply = () => ad.applyOps([...built.ops, ...commitSelectionOps(select, built.id, label)], label);
        // An empty text node is made to be typed into: it opens the run its first edit's commit joins, so one
        // undo takes the node and its text together. One arriving with text, as a paste does, stays its own entry.
        // An adapter whose `applyOps` keeps its own history records nothing in the batch.
        if (shapeKindInfo(extras.kind)?.text && !(extras as { text?: string }).text) {
          sc.batch(label, apply, textEditJoin(String(built.id)));
        }
        else apply();
        return built.id;
      },
    };
  });
}
