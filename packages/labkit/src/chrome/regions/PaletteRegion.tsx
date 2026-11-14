import { Icon } from '@weasel-js/ui/components/Icon';
import { ToolButton } from '@weasel-js/ui/components/ToolButton';
import { ToolGroup } from '@weasel-js/ui/components/ToolGroup';
import { formatShortcut } from '@weasel-js/ui/components/ToolPalette';
import { useRovingTabIndex } from '@weasel-js/ui/roving-tab-index';
import { Fragment } from 'react';
import type { RailItem, RegionContribution, ToolSlotContext, TrialChromeContext } from '../types';
import { groupsOf } from './groupsOf';

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
  const { rootRef, onKeyDown } = useRovingTabIndex<HTMLDivElement>({ orientation: 'vertical' });
  if (contributions.length === 0) return null;
  const entry = (c: RegionContribution<TCtx>) => {
    if (c.render) return <span key={c.id}>{c.render(ctx)}</span>;
    if (c.region !== region || !c.item) return null;
    const item = c.item as RailItem<TCtx>;
    const { icon, label, shortcut, disabled, disabledReason } = item;
    const command = 'onActivate' in item ? item : null;
    const run = command?.onActivate ?? null;
    return (
      <ToolButton
        key={c.id}
        icon={<Icon name={icon} size={16} />}
        label={label}
        shortcut={formatShortcut(shortcut)}
        active={command ? command.pressed === true : ctx.activeToolId === c.id}
        disabled={disabled}
        disabledReason={disabledReason}
        onClick={run ? () => run(ctx) : () => ctx.setActiveTool(c.id)}
      />
    );
  };
  return (
    <div
      ref={rootRef}
      className="lk-palette-region"
      role="toolbar"
      aria-label="Tools"
      aria-orientation="vertical"
      onKeyDown={onKeyDown}
    >
      {railRuns(contributions, region).map((run, i) => (
        <Fragment key={run.id}>
          {i > 0 && <hr className="lk-palette-region__rule" />}
          <ToolGroup orientation="vertical" groupKey={run.group} aria-label={run.group}>
            {run.entries.map(entry)}
          </ToolGroup>
        </Fragment>
      ))}
    </div>
  );
}

interface RailRun<TCtx extends ToolSlotContext> {
  id: string;
  group?: string;
  entries: RegionContribution<TCtx>[];
}

/** The rail's runs, a rule between each: a group where it first appears, and each stretch of ungrouped entries between
 *  them. Entries for another region draw nothing, so a run left with none of this region's is dropped. */
function railRuns<TCtx extends ToolSlotContext>(
  contributions: readonly RegionContribution<TCtx>[],
  region: string,
): RailRun<TCtx>[] {
  const runs: RailRun<TCtx>[] = [];
  for (const g of groupsOf(contributions)) {
    const entries = g.entries.filter((c) => c.render || c.region === region);
    if (!entries.length) continue;
    const grouped = entries[0].group != null;
    const last = runs.at(-1);
    if (!grouped && last && last.group === undefined) last.entries.push(...entries);
    else runs.push({ id: g.id, group: grouped ? g.key : undefined, entries });
  }
  return runs;
}
