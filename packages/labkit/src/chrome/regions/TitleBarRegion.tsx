import type { ReactNode } from 'react';
import type { TrialChromeContext, TrialContribution } from '../types';

/** Props for `<TitleBarRegion>`. */
export interface TitleBarRegionProps {
  contributions: readonly TrialContribution[];
  ctx: TrialChromeContext;
}

function renderEntry(c: TrialContribution, ctx: TrialChromeContext): ReactNode {
  if (c.render) return <span key={c.id}>{c.render(ctx)}</span>;
  if (c.region !== 'titlebar' || !c.item) return null;
  const { icon: Icon, label, shortcut, disabled, danger } = c.item;
  return (
    <button
      key={c.id}
      type="button"
      className={`lk-titlebar-button${danger ? ' lk-titlebar-button--danger' : ''}`}
      disabled={disabled}
      aria-label={label}
      title={shortcut ? `${label} (${shortcut})` : label}
      onClick={c.item.onActivate}
      // The bar behind these buttons is the window drag surface, so a press
      // that lands here must not also start a drag.
      onPointerDown={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <Icon size={14} />
    </button>
  );
}

/** Lays a trial's `titlebar` contributions out, at the far end of the bar. */
export function TitleBarRegion({ contributions, ctx }: TitleBarRegionProps) {
  if (contributions.length === 0) return null;
  return (
    <span className="lk-trial__titlebar-actions">
      {contributions.map((c) => renderEntry(c, ctx))}
    </span>
  );
}
