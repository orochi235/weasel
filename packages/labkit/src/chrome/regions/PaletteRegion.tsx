import { ToolButton, ToolGroup } from '../../passthrough/weasel-ui';
import { useRovingTabIndex } from '../../primitives/useRovingTabIndex';
import type {
  RegionContribution,
  ToolItem,
  ToolSlotContext,
  TrialChromeContext,
} from '../types';

/** Props for `<PaletteRegion>`. */
export interface PaletteRegionProps<TCtx extends ToolSlotContext = TrialChromeContext> {
  contributions: readonly RegionContribution<NoInfer<TCtx>>[];
  ctx: TCtx;
  /** Which region's items to lay out. The lab's rail names the same box
   *  `palette` too, so this only moves for a chrome that does not. */
  region?: string;
}

/** A tool strip: a trial's, or the lab's. Selection lives in whichever tool
 *  slot the context carries; this region only reflects it. */
export function PaletteRegion<TCtx extends ToolSlotContext = TrialChromeContext>({
  contributions,
  ctx,
  region = 'palette',
}: PaletteRegionProps<TCtx>) {
  const { ref, onKeyDown } = useRovingTabIndex<HTMLDivElement>('vertical');
  if (contributions.length === 0) return null;
  return (
    <div
      ref={ref}
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
          const { icon: Icon, label, shortcut, disabled } = c.item as ToolItem;
          return (
            <ToolButton
              key={c.id}
              icon={<Icon size={16} />}
              label={label}
              shortcut={shortcut}
              active={ctx.activeToolId === c.id}
              disabled={disabled}
              onClick={() => ctx.setActiveTool(c.id)}
            />
          );
        })}
      </ToolGroup>
    </div>
  );
}
