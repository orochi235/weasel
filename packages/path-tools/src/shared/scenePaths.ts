/**
 * What the click-driven path commands share: the press they act at and how
 * far it reaches, the strokes of the scene they act on, and the outlines that
 * stop or cut them.
 */
import type { ActionDeps } from '@weasel-js/routing';
import type { Path } from '@weasel-js/geom';
import { type NodeId, nodeOutline, type PathNode, resolveEditablePathOf, type SceneNode } from '@weasel-js/core';
import type { ImmediateParams } from '@weasel-js/routing';
import { pref } from '@weasel-js/prefs';

type AnyNode = SceneNode<unknown, string, unknown>;

/** Default reach of a click from the stroke it acts on, in screen pixels. */
export const DEFAULT_STROKE_REACH_PX = 6;

/** The `radiusPx` leaf of a click command's params form: how far its click reaches. */
export const strokeReachPref = () => pref.number('Reach', DEFAULT_STROKE_REACH_PX, {
  description: 'How near a stroke the click has to land to act on it.',
  min: 1, max: 30, step: 1, control: 'slider', unit: { scale: 1, suffix: 'px' },
});

type PressParams = (ImmediateParams & { radiusPx?: number }) | undefined;

/** A world point, and how far from it a stroke may be in world units. */
export interface StrokePress {
  at: { x: number; y: number };
  radius: number;
}

/** The press in `params` — a click's, or else a hover's pointer — and its
 *  reach, `radiusPx` at the view's scale; null with neither point. */
export function pressOf(deps: ActionDeps, params: unknown): StrokePress | null {
  const p = params as PressParams;
  const at = p?.press ?? p?.world;
  if (!at) return null;
  const scale = deps.view?.get().scale ?? { x: 1, y: 1 };
  const radius = (p?.radiusPx ?? DEFAULT_STROKE_REACH_PX) / Math.max(Math.abs(scale.x), Math.abs(scale.y));
  return { at, radius };
}

function renderOrder(deps: ActionDeps | undefined): readonly AnyNode[] {
  const scene = deps?.scene as { renderOrderNodes?(): readonly AnyNode[] } | undefined;
  return scene?.renderOrderNodes?.() ?? [];
}

/** Every leaf of the scene holding an editable path, back to front. */
export function scenePathNodes(deps: ActionDeps | undefined): PathNode[] {
  const out: PathNode[] = [];
  for (const node of renderOrder(deps)) {
    if (node.kind !== 'mark') continue;
    const path = resolveEditablePathOf(node);
    if (path) out.push({ id: node.id as NodeId, node, path });
  }
  return out;
}

/** The drawn outline of every leaf but `id`: what a stroke is cut at or
 *  stopped by. */
export function strokesBesides(deps: ActionDeps | undefined, id: string): Path[] {
  const out: Path[] = [];
  for (const node of renderOrder(deps)) {
    if (node.kind !== 'mark' || node.id === id) continue;
    const outline = nodeOutline(node);
    if (outline) out.push(outline);
  }
  return out;
}
