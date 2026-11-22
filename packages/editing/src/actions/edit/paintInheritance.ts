import type { NodeId } from '@weasel-js/core';
import { inheritedPaintIn } from '@weasel-js/core/engine';
import { INHERIT } from '@weasel-js/paint';
import { getOwn } from '@weasel-js/registry';

interface PaintScene {
  get(id: NodeId): { data?: unknown; parent?: string | null } | undefined;
}

const own = (scene: PaintScene, id: NodeId, key: string): unknown => {
  const data = scene.get(id)?.data;
  return data ? getOwn(data as Record<string, unknown>, key) : undefined;
};

/** `id`'s `key` at gesture start, with an `'inherit'` fill or stroke resolved to the paint it inherits. */
export function paintBaseOf(scene: PaintScene, id: NodeId, key: string): unknown {
  const node = scene.get(id);
  const value = own(scene, id, key);
  if (value !== INHERIT || !node || (key !== 'fill' && key !== 'stroke')) return value;
  return inheritedPaintIn(scene as never, node as never)?.[key] ?? null;
}

/** For each `'inherit'` node of `ids`, the nearest ancestor among `ids` it inherits `key` from, through
 *  `'inherit'` nodes only. */
export function paintHeirsIn(scene: PaintScene, ids: ReadonlySet<NodeId>, key: string): Map<NodeId, NodeId> {
  const heirs = new Map<NodeId, NodeId>();
  if (key !== 'fill' && key !== 'stroke') return heirs;
  for (const id of ids) {
    if (own(scene, id, key) !== INHERIT) continue;
    const seen = new Set<string>();
    for (let at = scene.get(id)?.parent ?? null; at !== null && !seen.has(at); at = scene.get(at as NodeId)?.parent ?? null) {
      seen.add(at);
      if (ids.has(at as NodeId)) {
        heirs.set(id, at as NodeId);
        break;
      }
      if (own(scene, at as NodeId, key) !== INHERIT) break;
    }
  }
  return heirs;
}
