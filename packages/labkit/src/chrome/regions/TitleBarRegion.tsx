import type { ReactNode } from 'react';
import { formatShortcut, Icon } from '../../passthrough/weasel-ui';
import type { TrialChromeContext, TrialContribution } from '../types';

/** Which end of the title bar a `<TitleBarRegion>` lays out: `'lead'` renders
 *  the contributions that leave `end` unset, before the title; `'actions'`
 *  renders the ones that set it, after everything else. */
export type TitleBarPlacement = 'lead' | 'actions';

/** Props for `<TitleBarRegion>`. */
export interface TitleBarRegionProps {
  contributions: readonly TrialContribution[];
  ctx: TrialChromeContext;
  /** Defaults to `'actions'`, where the built-ins live. */
  placement?: TitleBarPlacement;
}

function renderEntry(c: TrialContribution, ctx: TrialChromeContext): ReactNode {
  if (c.render) return <span key={c.id}>{c.render(ctx)}</span>;
  if (c.region !== 'titlebar' || !c.item) return null;
  const {
    icon,
    label,
    shortcut,
    disabled,
    disabledReason,
    danger,
    pressed,
    showLabel,
    onActivate,
  } = c.item;
  // Natively disabled, a button gets no hover, so its tooltip could not say why.
  const explained = disabled && disabledReason !== undefined;
  const keys = formatShortcut(shortcut);
  const name = keys ? `${label} (${keys})` : label;
  const className = [
    'lk-titlebar-button',
    danger && 'lk-titlebar-button--danger',
    showLabel && 'lk-titlebar-button--label',
  ]
    .filter(Boolean)
    .join(' ');
  return (
    <button
      key={c.id}
      type="button"
      className={className}
      disabled={disabled && !explained}
      aria-disabled={explained || undefined}
      aria-description={explained ? disabledReason : undefined}
      aria-pressed={pressed}
      aria-label={label}
      title={explained ? `${label}: ${disabledReason}` : name}
      onClick={explained ? undefined : () => onActivate(ctx)}
      // The bar behind these buttons is the window drag surface, so a press
      // that lands here must not also start a drag.
      onPointerDown={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <Icon name={icon} size={16} />
      {showLabel ? <span>{label}</span> : null}
    </button>
  );
}

/** Lays a trial's `titlebar` contributions out at one end of the bar. */
export function TitleBarRegion({ contributions, ctx, placement = 'actions' }: TitleBarRegionProps) {
  const wanted = placement === 'actions';
  const mine = contributions.filter((c) => (c.end ?? false) === wanted);
  if (mine.length === 0) return null;
  return (
    <span className={wanted ? 'lk-trial__titlebar-actions' : 'lk-trial__titlebar-lead'}>
      {mine.map((c) => renderEntry(c, ctx))}
    </span>
  );
}
