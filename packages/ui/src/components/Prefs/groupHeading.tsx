import type { ReactNode } from 'react';
import { isPrefLeaf, prefHeadingKey, type PrefGroup, type PrefLeaf } from '@weasel-js/prefs';
import { HiddenBadge, marksHidden } from './hidden';
import { prefRenderContext, renderPrefControl, shownLeaf, type WalkCtx } from './PrefsRow';
import { selectionAttrs } from './selection';
import { splitMarks } from './SplitRow';
import s from './Prefs.module.css';

type Entry = [key: string, child: PrefLeaf | PrefGroup];

/** What a group's heading draws beside its name, and the children left to draw under it. */
export interface GroupHeading {
  /** The class a heading takes while it holds `control`. */
  className: string | undefined;
  /** The control of the leaf marked `heading`, named for the group. */
  control: ReactNode;
  entries: Entry[];
}

/**
 * The leaf of `group` marked `heading`, lifted out of its rows into the
 * heading. It stays a row where the form has its own renderer for its kind,
 * whose control the form knows nothing of the size of, and where the surface
 * draws its own leaves.
 */
export function groupHeading(ctx: WalkCtx, group: PrefGroup, path: string): GroupHeading {
  const entries = Object.entries(group.children);
  const key = prefHeadingKey(group);
  const leaf = key === undefined ? undefined : group.children[key];
  if (key === undefined || leaf === undefined || !isPrefLeaf(leaf) || ctx.renderers?.[leaf.kind] || ctx.leaves) {
    return { className: undefined, control: null, entries };
  }
  const own = path === '' ? key : `${path}.${key}`;
  const shown = shownLeaf(ctx, leaf);
  if (!shown) return { className: undefined, control: null, entries };
  const { renderCtx } = prefRenderContext(ctx, own, { ...shown.pref, name: group.name }, shown.at);
  return {
    className: s.headed,
    control: (
      <span className={s.headingControl} {...selectionAttrs(own, ctx, true)}>
        {renderPrefControl(renderCtx, ctx.renderers)}
        {splitMarks(ctx.split, ctx.values, renderCtx, shown.at !== undefined)}
        {marksHidden(ctx.hidden, own) && <HiddenBadge />}
      </span>
    ),
    entries: entries.filter(([k]) => k !== key),
  };
}
