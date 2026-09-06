import type { ReactNode } from 'react';
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
  const { icon: Icon, label, shortcut, disabled, danger, onActivate } = c.item;
  return (
    <button
      key={c.id}
      type="button"
      className={`lk-titlebar-button${danger ? ' lk-titlebar-button--danger' : ''}`}
      disabled={disabled}
      aria-label={label}
      title={shortcut ? `${label} (${shortcut})` : label}
      onClick={() => onActivate(ctx)}
      // The bar behind these buttons is the window drag surface, so a press
      // that lands here must not also start a drag.
      onPointerDown={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <Icon size={14} />
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
