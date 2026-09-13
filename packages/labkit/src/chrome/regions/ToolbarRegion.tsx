import type { ReactNode } from 'react';
import { Toolbar } from '../../primitives/Toolbar';
import type { RegionContribution, ToolbarItem, TrialChromeContext } from '../types';

/** Props for `<ToolbarRegion>`. */
export interface ToolbarRegionProps<TCtx = TrialChromeContext> {
  contributions: readonly RegionContribution<NoInfer<TCtx>>[];
  ctx: TCtx;
  /** Which region's items to lay out; the lab's action bar is `header`. */
  region?: string;
  /** The bar's accessible name. */
  label?: string;
}

interface Group<TCtx> {
  key: string;
  end: boolean;
  entries: RegionContribution<TCtx>[];
}

/** Bucket by group, preserving first-appearance order. Ungrouped
 *  contributions each become their own bucket so they stay in place. */
function groupsOf<TCtx>(contributions: readonly RegionContribution<TCtx>[]): Group<TCtx>[] {
  const groups: Group<TCtx>[] = [];
  const byKey = new Map<string, Group<TCtx>>();
  for (const c of contributions) {
    if (c.group == null) {
      groups.push({ key: c.id, end: c.end ?? false, entries: [c] });
      continue;
    }
    let g = byKey.get(c.group);
    if (!g) {
      g = { key: c.group, end: c.end ?? false, entries: [] };
      byKey.set(c.group, g);
      groups.push(g);
    }
    g.entries.push(c);
  }
  return groups;
}

function renderEntry<TCtx>(
  c: RegionContribution<TCtx>,
  ctx: TCtx,
  region: string,
): ReactNode {
  if (c.render) return <span key={c.id}>{c.render(ctx)}</span>;
  if (c.region !== region || !c.item) return null;
  const { icon: Icon, label, shortcut, disabled, danger, showLabel, pressed, onActivate } =
    c.item as ToolbarItem<TCtx>;
  return (
    <Toolbar.Button
      key={c.id}
      iconOnly={!showLabel}
      variant={danger ? 'danger' : 'default'}
      disabled={disabled}
      pressed={pressed}
      aria-label={label}
      title={shortcut ? `${label} (${shortcut})` : label}
      onClick={() => onActivate(ctx)}
    >
      <Icon size={16} />
      {showLabel ? <span>{label}</span> : null}
    </Toolbar.Button>
  );
}

/** Lays a bar's contributions out, grouped by their `group`. */
export function ToolbarRegion<TCtx = TrialChromeContext>({
  contributions,
  ctx,
  region = 'toolbar',
  label = 'Trial actions',
}: ToolbarRegionProps<TCtx>) {
  if (contributions.length === 0) return null;
  const groups = groupsOf(contributions);
  return (
    <Toolbar aria-label={label}>
      {groups.map((g) => (
        <Toolbar.Group key={g.key} end={g.end} aria-label={g.key}>
          {g.entries.map((c) => renderEntry(c, ctx, region))}
        </Toolbar.Group>
      ))}
    </Toolbar>
  );
}
