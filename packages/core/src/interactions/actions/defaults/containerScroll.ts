/**
 * Wheel scrolling of a layout container whose content runs past its bounds,
 * such as `tileGrid({ overflow: 'scroll' })`. The strategy's `contentExtent`
 * says how far; the offset goes to `scene.scroll`, which moves what the view
 * shows and leaves the document where it is.
 */
import { pathContainsPoint, type Rect, rectContainsPoint } from '@weasel-js/geom';
import { ownClipOf } from 'canvas/ownClip';
import { defineAction, type ActionDeps } from '@weasel-js/routing';
import { poseDescriptorForNode, type PoseDescriptor } from 'core/geometry/poseDescriptor';
import { targetTransformOf, worldToLocal } from 'core/geometry/targetFrame';
import { composeWorldPose } from 'core/scene/composePose';
import { nodeGates } from 'core/scene/nodeGates';
import { scenePoseAdapter, sceneViewPoseAdapter } from 'core/scene/scenePoseAdapter';
import type { NodeId } from 'core/scene/types';
import { wheelPan } from 'core/viewport/wheelHandler';
import { poseDescriptorOf } from '../poseDescriptorDep';
import type { AnyScene } from 'core/scene/anyScene';
import type {} from '../actionParamSchema';
import { VIEWPORT_GROUP } from '../actionGroups';

/** How far a container's content can scroll on each axis, in its own units:
 *  `[min, max]`, zero included, so an unscrolled container is in range. */
export interface ScrollRange {
  x: readonly [number, number];
  y: readonly [number, number];
}

/**
 * How far `id`'s content can scroll: the span its layout's `contentExtent`
 * reaches past its bounds, read through the document fold the layout pass
 * arranges it in. Measured in the container's own frame, the axes a scroll
 * offset runs along, so a turned container scrolls by its own length rather
 * than its box's. `null` for a node whose layout reports no extent, one whose
 * pose is not a frame or is a singular one, and under a composition that cannot scroll.
 */
export function scrollRange(scene: AnyScene, id: NodeId, descriptor: PoseDescriptor<unknown>): ScrollRange | null {
  const layout = scene.layoutOf(id);
  const node = scene.get(id);
  const { compose, decompose, scroll } = scene.composition;
  if (!layout?.contentExtent || !node || !scroll) return null;
  const doc = scenePoseAdapter(scene);
  if (doc.definesFrame?.(id) === false) return null;
  const world = composeWorldPose(doc, id, compose);
  const own = decompose(world, world);
  if (own === null) return null;
  const b = poseDescriptorForNode(descriptor, node).getBounds(own);
  const children: { id: string; pose: unknown; node: ReturnType<AnyScene['get']> }[] = [];
  for (const cid of scene.childrenOf(id)) {
    const pose = decompose(world, composeWorldPose(doc, cid, compose));
    if (pose === null) return null;
    children.push({ id: cid as string, pose, node: scene.get(cid) });
  }
  const e = layout.contentExtent({ id: id as string, bounds: b, node }, children);
  return {
    x: [Math.min(0, e.x - b.x), Math.max(0, e.x + e.width - (b.x + b.width))],
    y: [Math.min(0, e.y - b.y), Math.max(0, e.y + e.height - (b.y + b.height))],
  };
}

const canScroll = (r: ScrollRange): boolean => r.x[0] < r.x[1] || r.y[0] < r.y[1];

const isBox = (p: unknown): p is Rect => {
  const b = p as Partial<Rect> | null;
  return typeof b?.x === 'number' && typeof b.y === 'number' && typeof b.width === 'number' && typeof b.height === 'number';
};

/** Whether the world point `at` falls on a container shown at `pose`, tested
 *  in its own unturned box, so a turned container takes only its own area. */
function shownAt(pose: unknown, at: { x: number; y: number }, bounds: () => Rect): boolean {
  const b = isBox(pose) ? pose : bounds();
  const p = isBox(pose) ? worldToLocal(targetTransformOf(pose), at.x, at.y) : at;
  return p !== null && rectContainsPoint(b, p.x, p.y);
}

/** A container whose content can scroll, with how far. */
export interface ScrollableContainer { id: NodeId; range: ScrollRange }

interface ShownScrollable extends ScrollableContainer { pose: unknown }

/** The shown containers under the world point `at` whose content can scroll,
 *  innermost first: the innermost one and each that holds it. A container's
 *  clip hides what it holds from the point wherever it leaves the point out. */
function scrollablesAt(scene: AnyScene, at: { x: number; y: number }, descriptor: PoseDescriptor<unknown>): ShownScrollable[] {
  const gates = nodeGates(scene);
  const view = sceneViewPoseAdapter(scene);
  const { compose } = scene.composition;
  const hits = new Map<NodeId, ShownScrollable>();
  let innermost: NodeId | null = null;
  const visit = (ids: readonly NodeId[]): void => {
    for (const id of ids) {
      const node = scene.get(id);
      if (!node || gates.hidden(id)) continue;
      const pose = composeWorldPose(view, id, compose);
      const range = scrollRange(scene, id, descriptor);
      if (range && canScroll(range) && shownAt(pose, at, () => poseDescriptorForNode(descriptor, node).getBounds(pose))) {
        hits.set(id, { id, range, pose });
        innermost = id;
      }
      const clip = ownClipOf(node, pose);
      if (clip === null || pathContainsPoint(clip, at.x, at.y)) visit(scene.childrenOf(id));
    }
  };
  visit(scene.roots);
  const out: ShownScrollable[] = [];
  for (let id: NodeId | null = innermost; id !== null; id = scene.get(id)?.parent ?? null) {
    const hit = hits.get(id);
    if (hit) out.push(hit);
  }
  return out;
}

/** The innermost shown container under the world point `at` whose content
 *  can scroll, with its range. */
export function scrollableAt(
  scene: AnyScene,
  at: { x: number; y: number },
  descriptor: PoseDescriptor<unknown>,
): ScrollableContainer | null {
  const hit = scrollablesAt(scene, at, descriptor)[0];
  return hit ? { id: hit.id, range: hit.range } : null;
}

/** How far one unit of scroll along each of a container's own axes moves its
 *  content in the world, read from the composition's own `scroll`. */
function worldPerScrollUnit(scene: AnyScene, pose: unknown): { x: number; y: number } {
  const scroll = scene.composition.scroll;
  const at = pose as Partial<Rect> | null;
  const length = (offset: { x: number; y: number }): number => {
    const moved = scroll?.(pose as never, offset) as Partial<Rect> | undefined;
    const d = Math.hypot((moved?.x ?? NaN) - (at?.x ?? NaN), (moved?.y ?? NaN) - (at?.y ?? NaN));
    return d > 0 && Number.isFinite(d) ? d : 1;
  };
  return { x: length({ x: 1, y: 0 }), y: length({ x: 0, y: 1 }) };
}

/** `from` moved by `d`, clamped to `range` but never past `from` in `d`'s
 *  direction, so an offset left outside a range that shrank steps back by the
 *  wheel rather than jumping to the range's edge. */
function stepToward(from: number, d: number, [lo, hi]: readonly [number, number]): number {
  if (d > 0) return Math.min(from + d, Math.max(hi, from));
  if (d < 0) return Math.max(from + d, Math.min(lo, from));
  return from;
}

function sceneOf(deps: ActionDeps | undefined): AnyScene | undefined {
  return (deps as { scene?: AnyScene } | undefined)?.scene;
}

/**
 * Wheel over a container whose content runs past its bounds scrolls that
 * content along the container's own axes, clamped to the strategy's
 * `contentExtent`; Shift+wheel scrolls it across. A container already at the
 * end of its range in the wheel's direction hands the wheel to the scrollable
 * container holding it, and past the outermost one the action passes, so the
 * wheel pans the viewport. Anywhere else it declines.
 */
export const containerScrollAction = defineAction({
  id: 'container.scroll',
  label: 'Scroll container (wheel)',
  group: VIEWPORT_GROUP,
  defaultBinding: [
    { spec: { kind: 'wheel' }, opts: { id: 'container.scroll.wheel', yields: true } },
    {
      spec: { kind: 'wheel', mods: { shift: true } },
      opts: { id: 'container.scroll.swapAxis', yields: true, params: { swapAxis: true } },
    },
  ],
  requires: ['scene', 'view', 'poseDescriptor'],
  enabled: (deps, at) => {
    const scene = sceneOf(deps);
    if (!scene || !at) return 'not-applicable';
    return scrollableAt(scene, at, poseDescriptorOf(deps?.poseDescriptor)) ? true : 'not-applicable';
  },
  invoker: {
    timing: 'immediate',
    run(deps, params) {
      const scene = sceneOf(deps);
      const view = deps.view?.get();
      const world = params?.world;
      if (!scene || !view || !world) return 'pass';
      const delta = { deltaX: params?.deltaX ?? 0, deltaY: params?.deltaY ?? 0 };
      // The pan's own conversion, from a view at the origin: how far the wheel moves in world units.
      const by = wheelPan({ x: 0, y: 0, scale: view.scale }, delta, { swapAxis: params?.swapAxis === true });
      for (const hit of scrollablesAt(scene, world, poseDescriptorOf(deps.poseDescriptor))) {
        const from = scene.scroll.get(hit.id) ?? { x: 0, y: 0 };
        const unit = worldPerScrollUnit(scene, hit.pose);
        const to = {
          ...from,
          x: stepToward(from.x, by.x / unit.x, hit.range.x),
          y: stepToward(from.y, by.y / unit.y, hit.range.y),
        };
        if (to.x === from.x && to.y === from.y) continue;
        scene.scroll.set(hit.id, to);
        return undefined;
      }
      return 'pass';
    },
  },
});
