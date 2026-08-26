import { ToolButton, ToolGroup } from '../../passthrough/weasel-ui';
import type { TrialChromeContext, TrialContribution } from '../types';

/** Props for `<PaletteRegion>`. */
export interface PaletteRegionProps {
  contributions: readonly TrialContribution[];
  ctx: TrialChromeContext;
}

/** A trial's tool strip. Selection lives in the trial's or the lab's tool
 *  slot; this region only reflects it. */
export function PaletteRegion({ contributions, ctx }: PaletteRegionProps) {
  if (contributions.length === 0) return null;
  return (
    <div
      className="lk-palette-region"
      role="toolbar"
      aria-label="Tools"
      aria-orientation="vertical"
    >
      <ToolGroup orientation="vertical">
        {contributions.map((c) => {
          if (c.render) return <span key={c.id}>{c.render(ctx)}</span>;
          if (c.region !== 'palette' || !c.item) return null;
          const { icon: Icon, label, shortcut, disabled } = c.item;
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
