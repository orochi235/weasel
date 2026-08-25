import type { TrialChromeContext, TrialContribution } from '../types';

/** Props for `<ViewportRegion>`. */
export interface ViewportRegionProps {
  contributions: readonly TrialContribution[];
  ctx: TrialChromeContext;
}

/**
 * Controls acting on the view of a trial. Anchored inside the content well
 * rather than in the toolbar, which acts on the trial itself.
 */
export function ViewportRegion({ contributions, ctx }: ViewportRegionProps) {
  if (contributions.length === 0) return null;
  return (
    <div className="lk-viewport-controls" role="group" aria-label="View">
      {contributions.map((c) => {
        if (c.render) return <span key={c.id}>{c.render(ctx)}</span>;
        if (c.region !== 'viewport' || !c.item) return null;
        const { icon: Icon, label, disabled } = c.item;
        return (
          <button
            key={c.id}
            type="button"
            className="lk-viewport-controls__button"
            aria-label={label}
            title={label}
            disabled={disabled}
            onClick={c.item.onActivate}
          >
            <Icon size={16} />
          </button>
        );
      })}
    </div>
  );
}
