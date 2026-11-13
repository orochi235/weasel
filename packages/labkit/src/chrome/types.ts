import type { IconSpec } from '@weasel-js/icons';
import type { MenuEntry } from '@weasel-js/menu';
import type { AppearanceProps } from '@weasel-js/ui/appearance';
import type { ReactNode } from 'react';
import type { AutoReports } from '../config/autoReports';
import type { ResolvedConfig } from '../config/types';
import type { SavedSnapshot } from '../state/types';

/** A named position in a trial's chrome. Content is not a region — that is
 *  the instrument. The lab's own boxes are named in `LabRegion`. */
export type TrialRegion = 'titlebar' | 'toolbar' | 'palette' | 'sidebar' | 'viewport' | 'status';

/** Where a trial's sidebar sections go: `'dock'` lays them out in a pane beside the trial's body, `'float'` in a
 *  panel over the body that a toggle in the title bar opens, so the body keeps the trial's whole width. */
export type TrialSidebar = 'dock' | 'float';

/** A button that runs once when pressed: it holds no focus and binds no
 *  input. `TCtx` is the chrome context its `onActivate` is handed — a trial's,
 *  or the lab's for a lab-level region. */
export interface CommandItem<TCtx = TrialChromeContext> {
  icon: IconSpec;
  label: string;
  /** Shown in the tooltip. Not bound here — the trial owns its keymap. */
  shortcut?: string;
  disabled?: boolean;
  /** Why it is disabled, read in its tooltip while it is. */
  disabledReason?: string;
  /** A toggle rather than a command: reads as held down while true. On a rail
   *  it reads as current, as the current tool does. */
  pressed?: boolean;
  /** Handed the chrome context it was declared against, so a contribution can
   *  reach `ctx.saveSnapshot()` and the rest without the `render` escape. A
   *  zero-argument handler stays valid. */
  onActivate: (ctx: TCtx) => void;
}

/** A command in a toolbar, with the looks a bar can give one. */
export interface ToolbarItem<TCtx = TrialChromeContext> extends CommandItem<TCtx> {
  kind?: 'command';
  /** Reddens on hover. For actions that discard work. */
  danger?: boolean;
  /** Render the label beside the glyph rather than only in the tooltip. */
  showLabel?: boolean;
}

/** A button in a toolbar that opens a menu. Its rows are `@weasel-js/menu`
 *  entries, which run themselves; a function is handed the chrome context
 *  each time the menu opens, so it lists what holds then. */
export interface ToolbarMenuItem<TCtx = TrialChromeContext> {
  kind: 'menu';
  /** Absent, the button reads its label. */
  icon?: IconSpec;
  label: string;
  /** Render the label beside the glyph rather than only in the tooltip. */
  showLabel?: boolean;
  /** Shown in the tooltip. Not bound here — the trial owns its keymap. */
  shortcut?: string;
  disabled?: boolean;
  /** Why it is disabled, read in its tooltip while it is. */
  disabledReason?: string;
  entries: readonly MenuEntry[] | ((ctx: TCtx) => readonly MenuEntry[]);
}

/** What a toolbar holds: commands and menus. */
export type ToolbarEntry<TCtx = TrialChromeContext> = ToolbarItem<TCtx> | ToolbarMenuItem<TCtx>;

/** A tool on a rail: pressing it writes the tool slot under the
 *  contribution's id, and it reads as current while the slot names it. */
export interface ToolItem {
  icon: IconSpec;
  label: string;
  /** Shown in the tooltip. Not bound here — the trial owns its keymap. */
  shortcut?: string;
  disabled?: boolean;
  /** Why it is disabled, read in its tooltip while it is. */
  disabledReason?: string;
}

/** What a rail holds: tools and commands. A command takes a slot and never
 *  writes the tool slot; it reads as current only while it is `pressed`. */
export type RailItem<TCtx = TrialChromeContext> = ToolItem | CommandItem<TCtx>;

/** A titled block in the sidebar. `stance` and `tint` work as on a
 *  `<PropertyPanel>`: what kind of content the section holds, and which of its
 *  peers it is. */
export interface SidebarSection extends AppearanceProps {
  title: string;
  /** Starts collapsed, until the trial remembers a fold of its own. */
  defaultCollapsed?: boolean;
  /** Offer the tear-out control. On by default; a section that only makes
   *  sense beside its trial sets this false. */
  undockable?: boolean;
  /** Where the tear-out control sends it. Default `'tile'`. */
  undockAs?: 'tile' | 'floating';
  /** Controls drawn in the section's title bar, after the title. They act on the body, so they are hidden while it is folded. */
  actions?: ReactNode;
  /** Take the pane's spare height and hold the body to it, so the body scrolls a part of itself under the rest. */
  fill?: boolean;
  body: ReactNode;
}

/** A control acting on the view of the trial, not on the trial. */
export interface ViewportControl<TCtx = TrialChromeContext> extends CommandItem<TCtx> {
  /** Reddens on hover. For actions that discard work. */
  danger?: boolean;
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
   *  declaration order. A contribution with no group keeps its own place. */
  group?: string;
  /** Pushes this contribution, and its group, to the far end of the region. */
  end?: boolean;
  /** Puts this contribution ahead of every one not marked so, the built-ins
   *  included: a sidebar section above Settings, say. */
  start?: boolean;
}

/**
 * A contribution is data the chrome renders, keyed to a region. Supplying
 * `render` instead of `item` opts out of the chrome's layout — deliberate,
 * and visible in the declaration.
 */
export type TrialContribution =
  | (ContributionBase & { region: 'titlebar'; item: ToolbarItem; render?: never })
  | (ContributionBase & { region: 'toolbar'; item: ToolbarEntry; render?: never })
  | (ContributionBase & { region: 'palette'; item: RailItem; render?: never })
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

/** What a sidebar region reflects and writes: which sections are folded, and —
 *  where the chrome can tear a section out — where it goes. A trial supplies
 *  all four; a lab supplies the fold state only. */
export interface SidebarSlotContext {
  collapsedSections: Readonly<Record<string, boolean>>;
  setSectionCollapsed: (key: string, collapsed: boolean) => void;
  undockedPanels?: readonly string[];
  undockPanel?: (sectionId: string, as?: 'tile' | 'floating') => void;
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
export interface TrialChromeContext extends ToolSlotContext, SidebarSlotContext {
  trialId: string;
  instrumentName: string;
  /** What the title bar reads, which is the instrument's title (or, lacking
   *  one, its name) until something calls `setTitle`. */
  title: string;
  /** Retitle this trial; `null` restores the instrument's title. Persisted with
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

  /** Whether a `<TrialLoupe>` following the trial's toggle is mounted in it.
   *  The loupe toggle is offered only while one is. */
  hasLoupe: boolean;
  /** Whether the trial's loupe is turned on. */
  loupeOn: boolean;
  toggleLoupe: () => void;
  /** Whether the eyedropper is on, offered beside the loupe toggle: a click on
   *  the stage picks the color under it, and one inside a lens what it shows. */
  dropperOn: boolean;
  toggleDropper: () => void;
  /** The color last picked, by the eyedropper or inside a lens; `null` before one. */
  pickedColor: string | null;

  /** Whether the trial sits in a `<Lightbox>` — every `<Workspace>` tile does
   *  unless the workspace turned it off. The expand toggle is offered only
   *  while it does. */
  canExpand: boolean;
  /** Whether the trial is showing in its lightbox. */
  expanded: boolean;
  toggleExpanded: () => void;

  /** The instrument's controls, resolved against the lab's rules. Empty for an instrument declaring no `config`. */
  configSchema: ResolvedConfig;
  config: unknown;
  /** The trial's unpinned paths. `config` stays raw, so a control drawn from
   *  it sits at the value un-pinning writes back. */
  auto: ReadonlySet<string>;
  /** The values the instrument reported for its auto paths (`RenderContext.reportAuto`), which the
   *  settings panel quotes. Absent for a chrome mounted without a trial. */
  reported?: AutoReports;
  setConfig: (key: string, value: unknown) => void;
  /** Writes a value an edit is passing through — a slider's drag, a number being typed — which the trial records
   *  as one undo step with the `setConfig` it settles on, however long the edit pauses. A `<ControlPanel>`'s
   *  `draftConfig`. A context built without one drafts through `setConfig`. */
  draftConfig?: (key: string, value: unknown) => void;
  /** The lab's values for the schema `configSchema` is drawn over, which `config` does not hold.
   *  `setConfig` writes a path of that schema there. */
  overValues?: Readonly<Record<string, unknown>>;

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
