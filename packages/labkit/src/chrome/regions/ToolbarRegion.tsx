import { Toolbar } from '@weasel-js/ui/components/Toolbar';
import type { ReactNode } from 'react';
import { formatShortcut, Icon, MenuButton } from '../../passthrough/weasel-ui';
import type {
  RegionContribution,
  ToolbarEntry,
  ToolbarMenuItem,
  TrialChromeContext,
} from '../types';
import { groupsOf } from './groupsOf';

/** Props for `<ToolbarRegion>`. */
export interface ToolbarRegionProps<TCtx = TrialChromeContext> {
  contributions: readonly RegionContribution<NoInfer<TCtx>>[];
  ctx: TCtx;
  /** Which region's items to lay out; the lab's action bar is `header`. */
  region?: string;
  /** The bar's accessible name. */
  label?: string;
}

function renderMenu<TCtx>(id: string, item: ToolbarMenuItem<TCtx>, ctx: TCtx): ReactNode {
  const { icon, label, showLabel, shortcut, disabled, disabledReason, entries } = item;
  const glyph = icon === undefined ? null : <Icon name={icon} size={16} />;
  return (
    <MenuButton
      key={id}
      aria-label={label}
      label={
        glyph && !showLabel ? (
          glyph
        ) : (
          <>
            {glyph}
            {label}
          </>
        )
      }
      shortcut={formatShortcut(shortcut)}
      disabled={disabled}
      disabledReason={disabledReason}
      entries={typeof entries === 'function' ? () => entries(ctx) : entries}
    />
  );
}

function renderEntry<TCtx>(c: RegionContribution<TCtx>, ctx: TCtx, region: string): ReactNode {
  if (c.render) return <span key={c.id}>{c.render(ctx)}</span>;
  if (c.region !== region || !c.item) return null;
  const item = c.item as ToolbarEntry<TCtx>;
  if (item.kind === 'menu') return renderMenu(c.id, item, ctx);
  const {
    icon,
    label,
    shortcut,
    disabled,
    disabledReason,
    danger,
    showLabel,
    pressed,
    onActivate,
  } = item;
  return (
    <Toolbar.Button
      key={c.id}
      iconOnly={!showLabel}
      grade={danger ? 'danger' : undefined}
      disabled={disabled}
      disabledReason={disabledReason}
      pressed={pressed}
      aria-label={label}
      title={label}
      shortcut={formatShortcut(shortcut)}
      icon={showLabel ? <Icon name={icon} size={16} /> : undefined}
      onClick={() => onActivate(ctx)}
    >
      {showLabel ? label : <Icon name={icon} size={16} />}
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
  // A trial's bar is a compact strip of its own; the lab's sits in the shell header, which draws the strip.
  const strip = region !== 'header';
  return (
    <Toolbar aria-label={label} size={strip ? 'sm' : 'md'} framed={strip}>
      {groups.map((g) => (
        <Toolbar.Group key={g.id} end={g.end} aria-label={g.key}>
          {g.entries.map((c) => renderEntry(c, ctx, region))}
        </Toolbar.Group>
      ))}
    </Toolbar>
  );
}
