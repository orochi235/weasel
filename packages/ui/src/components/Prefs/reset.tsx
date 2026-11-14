// A form's resets: each row's, and the heading's of a group that says `resettable`. What a reset reaches and
// writes is the form's source's to say (`PrefsSource`), through the one policy every params surface runs.

import type { ReactNode } from 'react';
import { leafAtReset, sourceIsAtReset, type PrefGroup, type PrefLeaf } from '@weasel-js/prefs';
import { ResetControl } from '../Properties/ResetControl';
import type { WalkCtx } from './PrefsRow';

/** Whether the form keeps the auto state of the leaf at `path`. */
export function autoTracked(ctx: WalkCtx, path: string): boolean {
  return ctx.source.autoAt(path) !== undefined;
}

/** A row's reset, where its leaf is not already as a reset leaves it. */
export function rowReset(ctx: WalkCtx, path: string, leaf: PrefLeaf): (() => void) | undefined {
  return leafAtReset(ctx.source, path, leaf) ? undefined : () => ctx.source.reset([path]);
}

/** The reset in a `resettable` group's heading, disabled while every leaf it reaches is as a reset leaves it. */
export function groupReset(ctx: WalkCtx, group: PrefGroup, path: string): ReactNode {
  if (group.resettable !== true || ctx.leaves) return null;
  return (
    <ResetControl
      name={group.name || 'all'}
      disabled={sourceIsAtReset(ctx.source, path)}
      onReset={() => ctx.source.reset([path])}
    />
  );
}
