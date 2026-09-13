import type { ComponentType, ReactNode } from 'react';
import type { ResolvedConfig } from '../config/types';
import type { ConfigField } from '../controls/types';
import type { SavedSnapshot } from '../state/types';

/** A named position in a trial's chrome. Content is not a region — that is
 *  the instrument. The lab's own boxes are named in `LabRegion`. */
export type TrialRegion = 'titlebar' | 'toolbar' | 'palette' | 'sidebar' | 'viewport' | 'status';

/** An icon component taking a pixel size, as `@weasel-js/ui` glyphs do. */
export type IconComponent = ComponentType<{ size?: number }>;

/** A button in a toolbar. `TCtx` is the chrome context its `onActivate` is
 *  handed — a trial's, or the lab's for a lab-level bar. */
export interface ToolbarItem<TCtx = TrialChromeContext> {
  icon: IconComponent;
  label: string;
  /** Shown in the tooltip. Not bound here — the trial owns its keymap. */
  shortcut?: string;
  disabled?: boolean;
  /** Reddens on hover. For actions that discard work. */
  danger?: boolean;
  /** A toggle rather than a command: renders `aria-pressed` and reads as held
   *  down while true. */
  pressed?: boolean;
  /** Render the label beside the glyph rather than only in the tooltip. */
  showLabel?: boolean;
  /** Handed the chrome context it was declared against, so a contribution can
   *  reach `ctx.saveSnapshot()` and the rest without the `render` escape. A
   *  zero-argument handler stays valid. */
  onActivate: (ctx: TCtx) => void;
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
  /** Starts collapsed, until the trial remembers a fold of its own. */
  defaultCollapsed?: boolean;
  /** Offer the tear-out control. On by default; a section that only makes
   *  sense beside its trial sets this false. */
  undockable?: boolean;
  /** Where the tear-out control sends it. Default `'tile'`. */
  undockAs?: 'tile' | 'floating';
  body: ReactNode;
}

/** A control acting on the view of the trial, not on the trial. */
export interface ViewportControl<TCtx = TrialChromeContext> {
  icon: IconComponent;
  label: string;
  disabled?: boolean;
  /** Handed the trial's chrome context, as `ToolbarItem.onActivate` is. */
  onActivate: (ctx: TCtx) => void;
}

/** A readout in the status bar. */
export interface StatusReadout {
  /** Short enough for a status bar. Rendered as text. */
  text: string;
  /** Tooltip. */
  title?: string;
}

/** What every contribution shares, whichever chrome it is declared against. */
export interface ContributionBase {
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
 * A tool slot a region can reflect and write. Both chrome contexts carry one:
 * a trial's resolves to the lab's when its instrument declares no tools.
 */
export interface ToolSlotContext {
  activeToolId: string | null;
  setActiveTool: (id: string) => void;
}

/**
 * A contribution as a region renderer sees it. A renderer checks the region
 * name against its own and narrows `item` itself, which is what lets one
 * renderer serve both chromes — the trial's and the lab's — without knowing
 * which context it was handed.
 */
export interface RegionContribution<TCtx> extends ContributionBase {
  region: string;
  item?: unknown;
  render?: (ctx: TCtx) => ReactNode;
}

/**
 * Everything a contribution can read about the trial it is being rendered
 * into. Replaces the three separate slot contexts, which each carried a
 * hand-picked subset.
 */
export interface TrialChromeContext extends ToolSlotContext {
  trialId: string;
  instrumentName: string;
  /** What the title bar reads, which is the instrument's name until something
   *  calls `setTitle`. */
  title: string;
  /** Retitle this trial; `null` restores the instrument name. Persisted with
   *  the trial, so a title survives a reload. */
  setTitle: (title: string | null) => void;
  isLastTrial: boolean;

  /** Null when the trial holds a view that is not the 2D one. */
  zoom: number | null;
  setZoom: (z: number) => void;

  canUndo: boolean;
  canRedo: boolean;
  undo: () => void;
  redo: () => void;

  /** Whether the trial's loupe is turned on. False for an instrument that
   *  declares none, whose chrome offers no way to turn one on. */
  loupeOn: boolean;
  toggleLoupe: () => void;

  /** The instrument's controls, resolved against the lab's rules. Always
   *  populated: a legacy `configSchema()` is adapted into the same shape. */
  configSchema: ResolvedConfig;
  /** @deprecated Read `configSchema`. Empty for an instrument declaring
   *  `config`, since a builder schema has no `ConfigField[]` form. */
  configFields: ConfigField[];
  config: unknown;
  setConfig: (key: string, value: unknown) => void;

  /** Which of this trial's collapsible sections are folded. A sidebar
   *  section's key is its contribution id; a section *inside* a contribution —
   *  a control panel's property group — is keyed `<contribution id>/<label>`.
   *  A section absent here is at its own default. Persisted with the trial. */
  collapsedSections: Readonly<Record<string, boolean>>;
  /** Fold or unfold one section, keyed as `collapsedSections` is. */
  setSectionCollapsed: (key: string, collapsed: boolean) => void;

  /** Section ids this trial currently has torn out of its sidebar. */
  undockedPanels: readonly string[];
  /** Tear a sidebar section out into the workspace. */
  undockPanel: (sectionId: string, as?: 'tile' | 'floating') => void;
  /** Put a torn-out section back in the sidebar. */
  dockPanel: (sectionId: string) => void;

  savedSnapshots: SavedSnapshot[];
  saveSnapshot: (name?: string) => void;
  loadSnapshot: (snapshotId: string) => void;

  clone: () => void;
  reset: () => void;
  close: () => void;
}
