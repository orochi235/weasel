import { ToolRail, type ToolRailItem } from '@weasel-js/ui';
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
 *  command presses, and latches only while it is `pressed`. */
export function PaletteRegion<TCtx extends ToolSlotContext = TrialChromeContext>({
  contributions,
  ctx,
  region = 'palette',
}: PaletteRegionProps<TCtx>) {
  if (contributions.length === 0) return null;
  const items = contributions.flatMap((c): ToolRailItem[] => {
    if (c.render) return [{ id: c.id, group: c.group, render: () => c.render?.(ctx) }];
    if (c.region !== region || !c.item) return [];
    const item = c.item as RailItem<TCtx>;
    const command = 'onActivate' in item ? item : null;
    return [
      {
        id: c.id,
        group: c.group,
        icon: item.icon,
        label: item.label,
        shortcut: item.shortcut,
        disabled: item.disabled,
        disabledReason: item.disabledReason,
        active: command ? command.pressed === true : ctx.activeToolId === c.id,
        onPress: command ? () => command.onActivate(ctx) : () => ctx.setActiveTool(c.id),
      },
    ];
  });
  return <ToolRail items={items} className="lk-palette-region" iconSize={16} />;
}
