import type { ComponentType, ReactNode } from 'react';
import type { ResolvedConfig } from '../config/types';
import type { ConfigField } from '../controls/types';
import type { SavedSnapshot } from '../state/types';

/** A named position in a trial's chrome. Content is not a region — that is
 *  the instrument. */
export type TrialRegion = 'titlebar' | 'toolbar' | 'palette' | 'sidebar' | 'viewport' | 'status';

/** An icon component taking a pixel size, as `@weasel-js/ui` glyphs do. */
export type IconComponent = ComponentType<{ size?: number }>;

/** A button in the trial toolbar. */
export interface ToolbarItem {
  icon: IconComponent;
  label: string;
  /** Shown in the tooltip. Not bound here — the trial owns its keymap. */
  shortcut?: string;
  disabled?: boolean;
  /** Reddens on hover. For actions that discard work. */
  danger?: boolean;
  /** Render the label beside the glyph rather than only in the tooltip. */
  showLabel?: boolean;
  onActivate: () => void;
}

/** A selectable tool in the palette region. */
export interface ToolItem {
  icon: IconComponent;
  label: string;
  shortcut?: string;
  disabled?: boolean;
}

/** A titled block in the sidebar. */
export interface SidebarSection {
  title: string;
  /** Starts collapsed. The open/closed state itself is the region's. */
  defaultCollapsed?: boolean;
  body: ReactNode;
}

/** A control acting on the view of the trial, not on the trial. */
export interface ViewportControl {
  icon: IconComponent;
  label: string;
  disabled?: boolean;
  onActivate: () => void;
}

/** A readout in the status bar. */
export interface StatusReadout {
  /** Short enough for a status bar. Rendered as text. */
  text: string;
  /** Tooltip. */
  title?: string;
}

/** What every contribution shares. */
interface ContributionBase {
  id: string;
  /** Groups sort by first appearance; items sort within a group by
   *  declaration order. Contributions with no group sort after grouped ones. */
  group?: string;
  /** Pushes this contribution, and its group, to the far end of the region. */
  end?: boolean;
}

/**
 * A contribution is data the chrome renders, keyed to a region. Supplying
 * `render` instead of `item` opts out of the chrome's layout — deliberate,
 * and visible in the declaration.
 */
export type TrialContribution =
  | (ContributionBase & { region: 'titlebar'; item: ToolbarItem; render?: never })
  | (ContributionBase & { region: 'toolbar'; item: ToolbarItem; render?: never })
  | (ContributionBase & { region: 'palette'; item: ToolItem; render?: never })
  | (ContributionBase & { region: 'sidebar'; item: SidebarSection; render?: never })
  | (ContributionBase & { region: 'viewport'; item: ViewportControl; render?: never })
  | (ContributionBase & { region: 'status'; item: StatusReadout; render?: never })
  | (ContributionBase & {
      region: TrialRegion;
      item?: never;
      render: (ctx: TrialChromeContext) => ReactNode;
    });

/**
 * Everything a contribution can read about the trial it is being rendered
 * into. Replaces the three separate slot contexts, which each carried a
 * hand-picked subset.
 */
export interface TrialChromeContext {
  trialId: string;
  instrumentName: string;
  isLastTrial: boolean;

  /** Null when the trial holds a view that is not the 2D one. */
  zoom: number | null;
  setZoom: (z: number) => void;

  canUndo: boolean;
  canRedo: boolean;
  undo: () => void;
  redo: () => void;

  /** The instrument's controls, resolved against the lab's rules. Always
   *  populated: a legacy `configSchema()` is adapted into the same shape. */
  configSchema: ResolvedConfig;
  /** @deprecated Read `configSchema`. Empty for an instrument declaring
   *  `config`, since a builder schema has no `ConfigField[]` form. */
  configFields: ConfigField[];
  config: unknown;
  setConfig: (key: string, value: unknown) => void;

  savedSnapshots: SavedSnapshot[];
  saveSnapshot: (name?: string) => void;
  loadSnapshot: (snapshotId: string) => void;

  clone: () => void;
  reset: () => void;
  close: () => void;

  /** Resolved active tool: the trial's slot, or the lab's when the trial has
   *  none. Null when neither holds one. */
  activeToolId: string | null;
  setActiveTool: (id: string) => void;
}
