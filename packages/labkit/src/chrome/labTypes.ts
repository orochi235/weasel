import type { ReactNode } from 'react';
import type { LabContextValue } from '../lab/LabContext';
import type {
  ContributionBase,
  StatusReadout,
  ToolbarItem,
  ToolItem,
  ToolSlotContext,
} from './types';

/**
 * A named position in the lab's own chrome — a box the shell owns, outside any
 * one trial. `header` and `footer` are the shell's two bars, named as
 * `<LabShell>` names them; `palette` is the tool rail down the side of the
 * workspace.
 */
export type LabRegion = 'header' | 'palette' | 'footer';

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
 */
export type LabContribution =
  | (ContributionBase & {
      region: 'header';
      item: ToolbarItem<LabChromeContext>;
      render?: never;
    })
  | (ContributionBase & { region: 'palette'; item: ToolItem; render?: never })
  | (ContributionBase & { region: 'footer'; item: StatusReadout; render?: never })
  | (ContributionBase & {
      region: LabRegion;
      item?: never;
      render: (ctx: LabChromeContext) => ReactNode;
    });
