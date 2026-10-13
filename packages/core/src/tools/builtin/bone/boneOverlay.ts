import { ellipsePath, linePath } from '@weasel-js/geom';
import type { DrawCommand } from '@weasel-js/renderer';
import type { RenderLayer } from 'core/layers/render';
import { viewToTransform } from 'core/viewport/view';
import { worldToScreen } from 'core/viewport/viewTransform';
import { jointPositions } from '@weasel-js/animator';
import type { Skeleton } from '@weasel-js/animator';

const BONE = '#4f9cf7';
const JOINT_FILL = '#ffffff';
const JOINT_RADIUS_PX = 4.5;

const dot = (x: number, y: number, r: number) => ellipsePath({ x: x - r, y: y - r, width: 2 * r, height: 2 * r });

/**
 * A screen-space layer drawing a skeleton as bones and joints at a constant size: a line from
 * each joint to its parent, a ring on each joint, and the active joint filled.
 */
export function createBoneOverlay(source: {
  id: string;
  /** The skeleton to draw, in the scene's space, or `null` for none. */
  skeleton(): Skeleton | null;
  active(): string | null;
  subscribe(fn: () => void): () => void;
}): RenderLayer<unknown> {
  return {
    id: source.id,
    label: 'Bones',
    space: 'screen',
    subscribe: source.subscribe,
    draw: (_data, view) => {
      const skeleton = source.skeleton();
      if (!skeleton || skeleton.joints.length === 0) return [];
      const t = viewToTransform(view);
      const at = new Map<string, { x: number; y: number }>();
      for (const [name, p] of jointPositions(skeleton)) {
        const [x, y] = worldToScreen(p.x, p.y, t);
        at.set(name, { x, y });
      }
      const out: DrawCommand[] = [];
      for (const joint of skeleton.joints) {
        if (joint.parent == null) continue;
        out.push({
          kind: 'path',
          path: linePath(at.get(joint.parent)!, at.get(joint.name)!),
          stroke: { paint: { color: BONE }, width: 2 },
        });
      }
      const active = source.active();
      for (const [name, p] of at) {
        out.push({
          kind: 'path',
          path: dot(p.x, p.y, JOINT_RADIUS_PX),
          fill: { paint: { kind: 'solid', color: name === active ? BONE : JOINT_FILL } },
          stroke: { paint: { color: BONE }, width: 1.5 },
        });
      }
      return out;
    },
  };
}
