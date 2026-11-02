/**
 * Wheel scrolling of a layout container whose content runs past its bounds,
 * such as `tileGrid({ overflow: 'scroll' })`. The strategy's `contentExtent`
 * says how far; the offset goes to `scene.scroll`, which moves what the view
 * shows and leaves the document where it is.
 */
import { clamp } from '@weasel-js/geom';
import type { Action, ActionDeps } from '@weasel-js/routing';
import { poseDescriptorForNode, type PoseDescriptor } from 'core/geometry/poseDescriptor';
import { targetTransformOf, worldToLocal } from 'core/geometry/targetFrame';
import { composeWorldPose } from 'core/scene/composePose';
import { nodeGates } from 'core/scene/nodeGates';
import { scenePoseAdapter, sceneViewPoseAdapter } from 'core/scene/scenePoseAdapter';
import type { NodeId, Scene } from 'core/scene/types';
import { wheelPan } from 'core/viewport/wheelHandler';
import { poseDescriptorOf } from '../poseDescriptorDep';
import type { ImmediateParams } from '@weasel-js/routing';

type AnyScene = Scene<unknown, string, unknown>;

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
 * pose is not a frame, and under a composition that cannot scroll.
 */
export function scrollRange(scene: AnyScene, id: NodeId, descriptor: PoseDescriptor<unknown>): ScrollRange | null {
  const layout = scene.layoutOf(id);
  const node = scene.get(id);
  const { compose, decompose, scroll } = scene.composition;
  if (!layout?.contentExtent || !node || !scroll) return null;
  const doc = scenePoseAdapter(scene);
  if (doc.definesFrame?.(id) === false) return null;
  const world = composeWorldPose(doc, id, compose);
  const b = poseDescriptorForNode(descriptor, node).getBounds(decompose(world, world));
  const children = scene.childrenOf(id).map((cid) => ({
    id: cid as string,
    pose: decompose(world, composeWorldPose(doc, cid, compose)),
  }));
  const e = layout.contentExtent({ id: id as string, bounds: b }, children);
  return {
    x: [Math.min(0, e.x - b.x), Math.max(0, e.x + e.width - (b.x + b.width))],
    y: [Math.min(0, e.y - b.y), Math.max(0, e.y + e.height - (b.y + b.height))],
  };
}

const canScroll = (r: ScrollRange): boolean => r.x[0] < r.x[1] || r.y[0] < r.y[1];

interface BoxLike { x: number; y: number; width: number; height: number }
const isBox = (p: unknown): p is BoxLike => {
  const b = p as Partial<BoxLike> | null;
  return typeof b?.x === 'number' && typeof b.y === 'number' && typeof b.width === 'number' && typeof b.height === 'number';
};

/** Whether the world point `at` falls on a container shown at `pose`, tested
 *  in its own unturned box, so a turned container takes only its own area. */
function shownAt(pose: unknown, at: { x: number; y: number }, bounds: () => BoxLike): boolean {
  const b = isBox(pose) ? pose : bounds();
  const p = isBox(pose) ? worldToLocal(targetTransformOf(pose), at.x, at.y) : at;
  return p !== null && p.x >= b.x && p.x <= b.x + b.width && p.y >= b.y && p.y <= b.y + b.height;
}

interface Scrollable { id: NodeId; range: ScrollRange }

/** The shown containers under the world point `at` whose content can scroll,
 *  innermost first: the innermost one and each that holds it. */
function scrollablesAt(scene: AnyScene, at: { x: number; y: number }, descriptor: PoseDescriptor<unknown>): Scrollable[] {
  const gates = nodeGates(scene);
  const view = sceneViewPoseAdapter(scene);
  const { compose } = scene.composition;
  const hits = new Map<NodeId, ScrollRange>();
  let innermost: NodeId | null = null;
  const visit = (ids: readonly NodeId[]): void => {
    for (const id of ids) {
      const node = scene.get(id);
      if (!node || gates.hidden(id)) continue;
      const range = scrollRange(scene, id, descriptor);
      if (range && canScroll(range)) {
        const pose = composeWorldPose(view, id, compose);
        if (shownAt(pose, at, () => poseDescriptorForNode(descriptor, node).getBounds(pose))) {
          hits.set(id, range);
          innermost = id;
        }
      }
      visit(scene.childrenOf(id));
    }
  };
  visit(scene.roots);
  const out: Scrollable[] = [];
  for (let id: NodeId | null = innermost; id !== null; id = scene.get(id)?.parent ?? null) {
    const range = hits.get(id);
    if (range) out.push({ id, range });
  }
  return out;
}

/** The innermost shown container under the world point `at` whose content
 *  can scroll, with its range. */
export function scrollableAt(
  scene: AnyScene,
  at: { x: number; y: number },
  descriptor: PoseDescriptor<unknown>,
): Scrollable | null {
  return scrollablesAt(scene, at, descriptor)[0] ?? null;
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
export const containerScrollAction: Action & { requires: string[] } = {
  id: 'container.scroll',
  label: 'Scroll container (wheel)',
  group: 'viewport',
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
      const world = (params as ImmediateParams | undefined)?.world;
      if (!scene || !view || !world) return 'pass';
      const delta = { deltaX: (params?.deltaX as number | undefined) ?? 0, deltaY: (params?.deltaY as number | undefined) ?? 0 };
      // The pan's own conversion, from a view at the origin: how far the wheel moves in world units.
      const by = wheelPan({ x: 0, y: 0, scale: view.scale }, delta, { swapAxis: params?.swapAxis === true });
      for (const hit of scrollablesAt(scene, world, poseDescriptorOf(deps.poseDescriptor))) {
        const from = scene.scroll.get(hit.id) ?? { x: 0, y: 0 };
        const to = { x: clamp(from.x + by.x, ...hit.range.x), y: clamp(from.y + by.y, ...hit.range.y) };
        if (to.x === from.x && to.y === from.y) continue;
        scene.scroll.set(hit.id, to);
        return undefined;
      }
      return 'pass';
    },
  },
};
