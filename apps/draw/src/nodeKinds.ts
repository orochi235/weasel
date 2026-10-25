/**
 * What draw calls a node: the routing kinds its canvas and sidebar classify by, the
 * title the Properties panel shows for one, and the name a Layers row falls
 * back on when the node has no label or text.
 */
import { groupNodeRouting, inferredNodeRouting, pathEffectOf, type NodeRoutingEntry, type PathEffect } from '@weasel-js/core';
import { PATH_EFFECT_SETTINGS_SCHEMA } from '@weasel-js/path-tools';

type EffectKind = PathEffect['kind'];
const EFFECT_KINDS: readonly EffectKind[] = ['textAlong', 'blend', 'bendAlong', 'repeatAlong'];

/** An effect's name as its settings section and its menu item give it. */
function effectName(kind: EffectKind): string {
  return PATH_EFFECT_SETTINGS_SCHEMA.children[kind]!.name;
}

/** The kit's inferred kinds, with a path effect of each kind ahead of `text`
 *  and `path`, since an effect node carries neither. */
export const DRAW_NODE_ROUTING: readonly NodeRoutingEntry[] = [
  groupNodeRouting,
  ...EFFECT_KINDS.map((kind) => ({ name: kind, matches: (data: unknown) => pathEffectOf({ data })?.kind === kind })),
  ...inferredNodeRouting.filter((e) => e !== groupNodeRouting),
];

/** The Properties panel's title for a routing kind. */
export function drawKindLabel(kind: string): string {
  if ((EFFECT_KINDS as readonly string[]).includes(kind)) return effectName(kind as EffectKind);
  return kind.length === 0 ? kind : kind[0]!.toUpperCase() + kind.slice(1);
}

/** The name of a path-effect node's effect, or `undefined` for any other node. */
export function effectNodeName(data: unknown): string | undefined {
  const effect = pathEffectOf({ data });
  return effect ? effectName(effect.kind) : undefined;
}
