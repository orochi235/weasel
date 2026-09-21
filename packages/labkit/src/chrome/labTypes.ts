import type { ReactNode } from 'react';
import type { LabContextValue } from '../lab/LabContext';
import type {
  ContributionBase,
  SidebarSection,
  StatusReadout,
  ToolbarItem,
  ToolItem,
  ToolSlotContext,
} from './types';

/**
 * A named position in the lab's own chrome — a box the shell owns, outside any
 * one trial. `header` and `footer` are the shell's two bars, named as
 * `<LabShell>` names them; `palette` is the tool rail down the side of the
 * workspace; `sidebar` is a column of sections left of the tool rail.
 */
export type LabRegion = 'header' | 'palette' | 'sidebar' | 'aside' | 'footer';

/**
 * Everything a lab-level contribution can read and command: the lab's own
 * state and operations, plus the lab's tool slot — which every trial whose
 * instrument declares no tools of its own reflects and writes.
 */
export interface LabChromeContext extends LabContextValue, ToolSlotContext {}

/**
 * A contribution to the lab's chrome. Shaped as `TrialContribution` is, and
 * merged and suppressed by the same rules, but keyed to the lab's regions and
 * rendered with the lab's context. Supplying `render` instead of `item` opts
 * out of the region's layout.
 *
 * `TCtx` is what the chrome hands a handler. It defaults to `LabChromeContext`,
 * which is what `<Lab>` renders its regions with; a consumer mounting the
 * regions under a bare `<LabShell>` names whatever it passes as `ctx` instead.
 */
export type LabContribution<TCtx = LabChromeContext> =
  | (ContributionBase & {
      region: 'header';
      item: ToolbarItem<TCtx>;
      render?: never;
    })
  | (ContributionBase & { region: 'palette'; item: ToolItem<TCtx>; render?: never })
  | (ContributionBase & { region: 'sidebar' | 'aside'; item: SidebarSection; render?: never })
  | (ContributionBase & { region: 'footer'; item: StatusReadout; render?: never })
  | (ContributionBase & {
      region: LabRegion;
      item?: never;
      render: (ctx: TCtx) => ReactNode;
    });
