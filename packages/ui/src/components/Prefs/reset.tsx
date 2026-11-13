// A form's resets: each row's, and the heading's of a group that says `resettable`. What a reset makes of a
// leaf is `prefResets`'s to say; this writes it through the form's own callbacks.

import type { ReactNode } from 'react';
import {
  prefCanAuto,
  prefIsReset,
  prefLeafValue,
  prefResets,
  prefValueAtPath,
  type PrefGroup,
  type PrefLeaf,
} from '@weasel-js/prefs';
import { ResetControl } from '../Properties/ResetControl';
import type { WalkCtx } from './PrefsRow';

/** Whether the form keeps the auto state of the leaf at `path`: it was handed `onAutoChange`, the leaf opts
 *  into auto (`prefCanAuto`), and `canInherit` lets it. */
export function autoTracked(ctx: WalkCtx, path: string, leaf: PrefLeaf): boolean {
  return ctx.onAutoChange !== undefined && prefCanAuto(leaf) && (ctx.canInherit?.(path) ?? true);
}

/** Whether the leaf at `path` already is what a reset makes of it, as the form shows it. */
export function leafIsReset(ctx: WalkCtx, path: string, leaf: PrefLeaf): boolean {
  const auto = autoTracked(ctx, path, leaf) ? (ctx.auto?.has(path) ?? false) : undefined;
  return prefIsReset(leaf, { auto, value: prefLeafValue(leaf, prefValueAtPath(ctx.values, path)) });
}

/** Put `node`, the leaf or the group at `path`, back as the schema says: through the owner's `onReset` where
 *  it gave one, else leaf by leaf through `onAutoChange`, and `onChange` with the default of a leaf the form
 *  keeps no auto state for. */
export function resetIn(ctx: WalkCtx, path: string, node: PrefLeaf | PrefGroup): void {
  if (ctx.onReset) {
    ctx.onReset(path);
    return;
  }
  for (const r of prefResets(node, path)) {
    if (r.auto && autoTracked(ctx, r.path, r.leaf)) ctx.onAutoChange!(r.path, true);
    else ctx.onChange(r.path, r.leaf.default);
  }
}

/** A row's reset, where its leaf is not already as a reset leaves it. */
export function rowReset(ctx: WalkCtx, path: string, leaf: PrefLeaf): (() => void) | undefined {
  if ((leaf as { readout?: boolean }).readout === true || leafIsReset(ctx, path, leaf)) return undefined;
  return () => resetIn(ctx, path, leaf);
}

/** The reset in a `resettable` group's heading, disabled while every leaf under it is as a reset leaves it. */
export function groupReset(ctx: WalkCtx, group: PrefGroup, path: string): ReactNode {
  if (group.resettable !== true || ctx.leaves) return null;
  const done = prefResets(group, path).every((r) => leafIsReset(ctx, r.path, r.leaf));
  return <ResetControl name={group.name || 'all'} disabled={done} onReset={() => resetIn(ctx, path, group)} />;
}
