import type { ReactNode } from 'react';
import { Toolbar } from '../../primitives/Toolbar';
import type { TrialChromeContext, TrialContribution } from '../types';

/** Props for `<ToolbarRegion>`. */
export interface ToolbarRegionProps {
  contributions: readonly TrialContribution[];
  ctx: TrialChromeContext;
}

interface Group {
  key: string;
  end: boolean;
  entries: TrialContribution[];
}

/** Bucket by group, preserving first-appearance order. Ungrouped
 *  contributions each become their own bucket so they stay in place. */
function groupsOf(contributions: readonly TrialContribution[]): Group[] {
  const groups: Group[] = [];
  const byKey = new Map<string, Group>();
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

function renderEntry(c: TrialContribution, ctx: TrialChromeContext): ReactNode {
  if (c.render) return <span key={c.id}>{c.render(ctx)}</span>;
  if (c.region !== 'toolbar' || !c.item) return null;
  const { icon: Icon, label, shortcut, disabled, danger, showLabel } = c.item;
  return (
    <Toolbar.Button
      key={c.id}
      iconOnly={!showLabel}
      variant={danger ? 'danger' : 'default'}
      disabled={disabled}
      aria-label={label}
      title={shortcut ? `${label} (${shortcut})` : label}
      onClick={c.item.onActivate}
    >
      <Icon size={16} />
      {showLabel ? <span>{label}</span> : null}
    </Toolbar.Button>
  );
}

/** Lays a trial's `toolbar` contributions out, grouped by their `group`. */
export function ToolbarRegion({ contributions, ctx }: ToolbarRegionProps) {
  if (contributions.length === 0) return null;
  const groups = groupsOf(contributions);
  return (
    <Toolbar>
      {groups.map((g) => (
        <Toolbar.Group key={g.key} end={g.end} aria-label={g.key}>
          {g.entries.map((c) => renderEntry(c, ctx))}
        </Toolbar.Group>
      ))}
    </Toolbar>
  );
}
