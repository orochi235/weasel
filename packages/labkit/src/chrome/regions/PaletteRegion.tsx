import { ToolButton, ToolGroup, useRovingTabIndex } from '../../passthrough/weasel-ui';
import type { RailItem, RegionContribution, ToolSlotContext, TrialChromeContext } from '../types';

/** Props for `<PaletteRegion>`. */
export interface PaletteRegionProps<TCtx extends ToolSlotContext = TrialChromeContext> {
  contributions: readonly RegionContribution<NoInfer<TCtx>>[];
  ctx: TCtx;
  /** Which region's items to lay out. The lab's rail names the same box
   *  `palette` too, so this only moves for a chrome that does not. */
  region?: string;
}

/** A rail of tools and commands: a trial's, or the lab's. Selection lives in
 *  whichever tool slot the context carries; this region only reflects it. A
 *  command presses, and never latches. */
export function PaletteRegion<TCtx extends ToolSlotContext = TrialChromeContext>({
  contributions,
  ctx,
  region = 'palette',
}: PaletteRegionProps<TCtx>) {
  const { rootRef, onKeyDown } = useRovingTabIndex<HTMLDivElement>({ orientation: 'vertical' });
  if (contributions.length === 0) return null;
  return (
    <div
      ref={rootRef}
      className="lk-palette-region"
      role="toolbar"
      aria-label="Tools"
      aria-orientation="vertical"
      onKeyDown={onKeyDown}
    >
      <ToolGroup orientation="vertical">
        {contributions.map((c) => {
          if (c.render) return <span key={c.id}>{c.render(ctx)}</span>;
          if (c.region !== region || !c.item) return null;
          const item = c.item as RailItem<TCtx>;
          const { icon: Icon, label, shortcut, disabled } = item;
          const run = 'onActivate' in item ? item.onActivate : null;
          return (
            <ToolButton
              key={c.id}
              icon={<Icon size={16} />}
              label={label}
              shortcut={shortcut}
              active={run ? false : ctx.activeToolId === c.id}
              disabled={disabled}
              onClick={run ? () => run(ctx) : () => ctx.setActiveTool(c.id)}
            />
          );
        })}
      </ToolGroup>
    </div>
  );
}
