/**
 * Wheel scrolling of a layout container whose content runs past its bounds,
 * such as `tileGrid({ overflow: 'scroll' })`. The strategy's `contentExtent`
 * says how far; the offset goes to `scene.scroll`, which moves what the view
 * shows and leaves the document where it is.
 */
import type { Action, ActionDeps } from '@weasel-js/routing';
import { poseDescriptorForNode, type PoseDescriptor } from 'core/geometry/poseDescriptor';
import { composeWorldPose } from 'core/scene/composePose';
import { nodeGates } from 'core/scene/nodeGates';
import { scenePoseAdapter, sceneViewPoseAdapter } from 'core/scene/scenePoseAdapter';
import type { NodeId, Scene } from 'core/scene/types';
import { wheelPan } from 'core/viewport/wheelHandler';
import { poseDescriptorOf } from '../poseDescriptorDep';

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
 * arranges it in. `null` for a node whose layout reports no extent. Measured
 * on axis-aligned boxes, so a turned container's range is its box's.
 */
export function scrollRange(scene: AnyScene, id: NodeId, descriptor: PoseDescriptor<unknown>): ScrollRange | null {
  const layout = scene.layoutOf(id);
  const node = scene.get(id);
  if (!layout?.contentExtent || !node) return null;
  const doc = scenePoseAdapter(scene);
  const { compose } = scene.composition;
  const b = poseDescriptorForNode(descriptor, node).getBounds(composeWorldPose(doc, id, compose));
  const children = scene.childrenOf(id).map((cid) => ({ id: cid as string, pose: composeWorldPose(doc, cid, compose) }));
  const e = layout.contentExtent({ id: id as string, bounds: b }, children);
  return {
    x: [Math.min(0, e.x - b.x), Math.max(0, e.x + e.width - (b.x + b.width))],
    y: [Math.min(0, e.y - b.y), Math.max(0, e.y + e.height - (b.y + b.height))],
  };
}

const canScroll = (r: ScrollRange): boolean => r.x[0] < r.x[1] || r.y[0] < r.y[1];

/** The innermost shown container under the world point `at` whose content
 *  can scroll, with its range. */
export function scrollableAt(
  scene: AnyScene,
  at: { x: number; y: number },
  descriptor: PoseDescriptor<unknown>,
): { id: NodeId; range: ScrollRange } | null {
  const gates = nodeGates(scene);
  const view = sceneViewPoseAdapter(scene);
  const { compose } = scene.composition;
  let found: { id: NodeId; range: ScrollRange } | null = null;
  const visit = (ids: readonly NodeId[]): void => {
    for (const id of ids) {
      const node = scene.get(id);
      if (!node || gates.hidden(id)) continue;
      const range = scrollRange(scene, id, descriptor);
      if (range && canScroll(range)) {
        const b = poseDescriptorForNode(descriptor, node).getBounds(composeWorldPose(view, id, compose));
        if (at.x >= b.x && at.x <= b.x + b.width && at.y >= b.y && at.y <= b.y + b.height) found = { id, range };
      }
      visit(scene.childrenOf(id));
    }
  };
  visit(scene.roots);
  return found;
}

const clamp = (v: number, [lo, hi]: readonly [number, number]): number => Math.min(hi, Math.max(lo, v));

function sceneOf(deps: ActionDeps | undefined): AnyScene | undefined {
  return (deps as { scene?: AnyScene } | undefined)?.scene;
}

/**
 * Wheel over a container whose content runs past its bounds scrolls that
 * content, clamped to the strategy's `contentExtent`; Shift+wheel scrolls it
 * across. Anywhere else it declines, and the wheel pans the viewport.
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
      const x = params?.worldX as number | undefined;
      const y = params?.worldY as number | undefined;
      if (!scene || !view || x === undefined || y === undefined) return;
      const hit = scrollableAt(scene, { x, y }, poseDescriptorOf(deps.poseDescriptor));
      if (!hit) return;
      const delta = { deltaX: (params?.deltaX as number | undefined) ?? 0, deltaY: (params?.deltaY as number | undefined) ?? 0 };
      // The pan's own conversion, from a view at the origin: how far the wheel moves in world units.
      const by = wheelPan({ x: 0, y: 0, scale: view.scale }, delta, { swapAxis: params?.swapAxis === true });
      const from = scene.scroll.get(hit.id) ?? { x: 0, y: 0 };
      scene.scroll.set(hit.id, { x: clamp(from.x + by.x, hit.range.x), y: clamp(from.y + by.y, hit.range.y) });
    },
  },
};
