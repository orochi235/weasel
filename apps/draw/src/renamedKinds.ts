// The kinds a drawing saved before the 2026-11-14 path tool renames names, under the names this build reads.

const EFFECT_KINDS: Readonly<Record<string, string>> = { blend: 'tween' };
const WARP_KINDS: Readonly<Record<string, string>> = { puppet: 'pin', distort: 'plane', envelope: 'cloth' };

const isObject = (v: unknown): v is Record<string, unknown> => v !== null && typeof v === 'object' && !Array.isArray(v);

function rename(holder: unknown, names: Readonly<Record<string, string>>): void {
  if (!isObject(holder) || typeof holder.kind !== 'string' || !Object.hasOwn(names, holder.kind)) return;
  holder.kind = names[holder.kind];
}

/**
 * Rewrite a path effect's `blend` kind to `tween`, and a held warp's `puppet`, `distort`, and `envelope` to `pin`,
 * `plane`, and `cloth`, wherever node data holds them: in a scene and in the node data a history snapshot's ops
 * copy. Walks in place and returns the same node.
 */
export function migrateRenamedKinds<T>(node: T): T {
  if (node == null || typeof node !== 'object') return node;
  if (Array.isArray(node)) {
    for (const item of node) migrateRenamedKinds(item);
    return node;
  }
  const obj = node as Record<string, unknown>;
  rename(obj.pathEffect, EFFECT_KINDS);
  if (isObject(obj.warp)) rename(obj.warp.warp, WARP_KINDS);
  for (const k of Object.keys(obj)) migrateRenamedKinds(obj[k]);
  return node;
}
