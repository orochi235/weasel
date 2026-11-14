import type { PrefGroup, PrefSection } from '@weasel-js/prefs';
import type { AppearanceProps } from '@weasel-js/ui/appearance';
import type { Motif } from '@weasel-js/ui/components/MotifFrame';
import { PrefsSource } from '@weasel-js/ui/components/PrefsSource';
import {
  type CollapseProps,
  type PropertyAlign,
  type PropertyDensity,
  PropertyList,
  type PropertyListPack,
  PropertyPanel,
  type PropertyRowLayout,
} from '@weasel-js/ui/components/Properties';
import { type ReactNode, useMemo, useState } from 'react';
import { auto as autoValue, isAuto } from '../config/auto';
import { applyConfigWrite, autoPathsOf, resolveAutoConfig } from '../config/autoConfig';
import { type AutoReports, withAutoReports } from '../config/autoReports';
import { valueAtPath } from '../config/path';
import type { LeafRenderer, ResolvedConfig } from '../config/types';
import { type ControlPack, gridOf } from './controlPack';
import { FieldChoicesContext, useFieldChoicesOf } from './fieldChoices';
import { useLabConfigSource } from './labSource';
import { panelRows } from './panelRows';

export type { ControlPack } from './controlPack';

/** Props for {@link ControlPanel}. */
export interface ControlPanelProps<TC extends Record<string, unknown>> extends AppearanceProps {
  /** The config schema to draw, resolved: `useResolvedConfig(f.schema({ … }))`, or a trial's `configSchema`. */
  schema: ResolvedConfig;
  config: TC;
  /** Writes one value. The path is dotted for a leaf inside an `f.group`, and
   *  the bare key for one at the root. A `.resettable()` group's reset is one
   *  write too, of the group's whole value at the group's own path. */
  setConfig: (path: string, value: unknown) => void;
  /**
   * Writes a value an edit is passing through: each keystroke of a typed
   * number or text, each move of a slider's drag. Given, the instrument can
   * follow the edit while `setConfig` hears only the value it settles on,
   * once, which is one undo step. Omitted, a typed field writes only on Enter
   * or blur, and Escape writes nothing; a slider writes as it moves.
   */
  draftConfig?: (path: string, value: unknown) => void;
  /** What is wrong with a value, by its path: each shows under its row, as an alert, and a custom row is
   *  handed its own as `error`. A paired row shows its cells'. */
  errors?: Readonly<Record<string, ReactNode>>;
  /**
   * Control overrides and app-defined kinds, PrefsForm-style. Keys are config
   * paths (checked first) or leaf kinds. A renderer returning `null` collapses
   * the row; entries override the built-in rows on collision.
   */
  renderers?: Record<string, LeafRenderer>;
  /**
   * The schema this one's aliases point into. Default: this schema itself. A
   * panel drawn from a schema of aliases into another passes that other: each
   * alias row is drawn as the leaf of it at the alias's path, reads and writes
   * `config` at that path, and is hidden and disabled by that leaf's
   * conditions as well as its own. Those conditions read `config`, and that
   * schema's defaults where `config` holds nothing. A condition of this
   * schema's own may read a setting of that one the same way: hand
   * `resolveConfigSchema` that schema too, or it refuses the condition.
   * Defaults to the schema's own `over`.
   */
  over?: PrefGroup | PrefSection;
  /** How rows pack into the two-column grid, which drops to one column where
   *  the panel is too narrow for two. Defaults to `'pairs'`, two rows to a
   *  line; `'one-up'` gives each row its own. */
  pack?: ControlPack;
  /** Where a row's label sits relative to its control. Defaults to `'inline'`,
   *  beside it; `'block'` puts every label above its control. */
  layout?: PropertyRowLayout;
  /** The `MotifFrame` motif every group and section is drawn in, as `stereo()`,
   *  where it names none of its own. Unset, they keep the default card. */
  motif?: Motif;
  /** Room the rows get. Passed straight to the property list. */
  density?: PropertyDensity;
  /** Cross-axis alignment of an inline row's label and control. */
  align?: PropertyAlign;
  /**
   * Fold each section away behind a twisty, starting `'open'` or `'closed'`.
   * Unset draws the heading alone, as the panel always has — unless a section
   * in the schema declares how it opens, which makes that section foldable on
   * its own and outranks this for that one section.
   */
  collapse?: 'open' | 'closed';
  /**
   * Which sections are folded, keyed as `onCollapse` reports them. Given, the
   * panel keeps no state of its own: every toggle arrives at `onCollapse`
   * instead, which is where a lab that remembers a trial's sections writes
   * them.
   */
  collapsed?: Readonly<Record<string, boolean>>;
  /** A fold moved. The key is a section's label — prefixed by its group's
   *  dotted path when the section sits inside one — or a group's own path. */
  onCollapse?: (key: string, collapsed: boolean) => void;
  /** Dotted paths currently unpinned. A row in this set reads out `auto` beside its live, ghosted control,
   *  an edit to which writes the new value and so pins it, and clicking its label writes the sentinel back
   *  through `setConfig`. Omitted, the panel keeps the set itself, starting from the leaves that say
   *  `.initial(auto)`: the labels still toggle and the sentinel never reaches `setConfig`, which would
   *  otherwise store it as the row's value. */
  auto?: ReadonlySet<string>;
  /** Values the instrument says it used for auto paths, by dotted path: what `RenderContext.reportAuto`
   *  collects. An auto row reads its report over its resolver's value; a pinned row's report is ignored. */
  reported?: AutoReports;
  /** Draw leaves marked `hidden`. */
  showHidden?: boolean;
  /** Paths whose rows are marked as changed, as `PrefsForm`'s `changed` marks them: what differs from a
   *  default, or from what was last saved, is the caller's to say. A paired row is marked when any of its
   *  cells is named, and an alias row when the leaf it shows is. */
  changed?: ReadonlySet<string>;
  /** Heads the panel. With `title`, any appearance prop given, or with the panel
   *  made to fold, the rows sit in a `<PropertyPanel>` carrying them; with
   *  none, they are the bare list. */
  title?: ReactNode;
  /** Give the whole panel a twisty that folds it down to its title. Its state
   *  rides with the sections': the key is `''`, the root's own path, in both
   *  `collapsed` and `onCollapse`. */
  collapsible?: boolean;
  /** Start the panel folded. Implies `collapsible`. */
  defaultCollapsed?: boolean;
  /** When a twisty shows, the panel's and each section's: `'folded'` hides it
   *  while the contents are open and lets a press on the title fold them. */
  twisty?: CollapseProps['twisty'];
  className?: string;
}

type Write = (path: string, value: unknown) => void;

/**
 * Which rows are unpinned, and what hands one to its resolver or takes it
 * back. An owner that tracks the set decides what a dot means; one that does
 * not gets a panel that decides for itself, because the alternative is handing
 * it a sentinel it would write into the config as though it were a value.
 */
function usePanelAuto(
  given: ReadonlySet<string> | undefined,
  resolved: ResolvedConfig,
  config: Record<string, unknown>,
  writes: { setConfig: Write; draftConfig?: Write },
) {
  // A panel keeping its own set opens with the leaves its schema starts auto, as a trial does.
  const [ownAuto, setOwnAuto] = useState<ReadonlySet<string>>(() => new Set(autoPathsOf(resolved)));
  const mark = (path: string, next: boolean): void =>
    setOwnAuto((prev) => {
      if (prev.has(path) === next) return prev;
      const now = new Set(prev);
      if (next) now.add(path);
      else now.delete(path);
      return now;
    });
  // An owner tracking the set hears every edit as a write that pins, and a sentinel in a group's value (a
  // reset) as unpinning that leaf; a panel tracking its own does both here, as `applyConfigWrite` says.
  const pinning = (write: Write): Write =>
    given
      ? write
      : (path, value) => {
          const next = applyConfigWrite(config, [...ownAuto], path, value);
          setOwnAuto(
            next.autoPaths.length === ownAuto.size && next.autoPaths.every((p) => ownAuto.has(p))
              ? ownAuto
              : new Set(next.autoPaths),
          );
          if (!isAuto(value)) write(path, valueAtPath(next.config, path));
        };
  const setRowAuto = (path: string, next: boolean, value: unknown): void => {
    if (given) {
      writes.setConfig(path, next ? autoValue : value);
      return;
    }
    mark(path, next);
    // Pinning keeps whatever the row was showing, the same value the controlled
    // path writes back.
    if (!next) writes.setConfig(path, value);
  };
  return {
    auto: given ?? ownAuto,
    setRowAuto,
    setConfig: pinning(writes.setConfig),
    draftConfig: writes.draftConfig && pinning(writes.draftConfig),
  };
}

/**
 * What the instrument is reading, with what it reported over that. A row draws and reports from this
 * rather than calling its own resolver against the raw config, which would disagree with the instrument
 * whenever a resolver depends on another auto path.
 */
function useShown<TC>(
  resolved: ResolvedConfig,
  config: TC,
  auto: ReadonlySet<string>,
  reported: AutoReports | undefined,
): TC {
  return useMemo(
    () =>
      auto.size > 0
        ? withAutoReports(resolveAutoConfig(resolved, config, auto), reported, auto)
        : config,
    [resolved, config, auto, reported],
  );
}

/** How each section of a panel folds: what `panelRows` hands a section's list, keyed by the section. */
function sectionFold(
  resolved: ResolvedConfig,
  gridPack: PropertyListPack,
  {
    collapse,
    collapsed,
    onCollapse,
    twisty,
  }: Pick<
    ControlPanelProps<Record<string, unknown>>,
    'collapse' | 'collapsed' | 'onCollapse' | 'twisty'
  >,
) {
  // A section that declares how it opens is foldable whether or not the lab
  // asked for folds — there is nothing else for the declaration to mean.
  const folds =
    collapse !== undefined ||
    collapsed !== undefined ||
    onCollapse !== undefined ||
    resolved.sections.some((s) => s.collapsed !== undefined);
  const startsFolded = collapse === 'closed';
  return (key: string, declared?: boolean, grid: PropertyListPack = gridPack) => ({
    pack: grid,
    collapsible: folds,
    twisty,
    defaultCollapsed: declared ?? startsFolded,
    collapsed: collapsed ? (collapsed[key] ?? declared ?? startsFolded) : undefined,
    onCollapsedChange: onCollapse ? (next: boolean) => onCollapse(key, next) : undefined,
  });
}

/** Render an instrument's config schema as a stack of controls, each writing
 *  back through `setConfig`. Built on the property rows, so a lab's controls
 *  are the same aligned, themed rows the rest of the kit uses. */
export function ControlPanel<TC extends Record<string, unknown>>({
  schema: resolved,
  config,
  setConfig,
  draftConfig,
  errors,
  renderers,
  over: overGiven,
  pack = 'pairs',
  layout = 'inline',
  motif,
  density,
  align,
  collapse,
  collapsed,
  onCollapse,
  collapsible,
  defaultCollapsed,
  twisty,
  auto: given,
  reported,
  showHidden = false,
  changed,
  title,
  className,
  ...appearance
}: ControlPanelProps<TC>) {
  const choices = useFieldChoicesOf(resolved.group);
  const over = overGiven ?? resolved.over;

  const { auto, setRowAuto, ...writes } = usePanelAuto(given, resolved, config, {
    setConfig,
    draftConfig,
  });

  const shown = useShown(resolved, config, auto, reported);
  const prefs = useLabConfigSource({
    resolved,
    config,
    shown,
    setConfig: writes.setConfig,
    draftConfig: writes.draftConfig,
    auto,
    setRowAuto,
    over,
  });

  const gridPack = gridOf(pack);
  const fold = sectionFold(resolved, gridPack, { collapse, collapsed, onCollapse, twisty });
  const { body, lift, loosePaths } = panelRows({
    resolved,
    config,
    shown,
    ...writes,
    errors,
    renderers,
    over,
    showHidden,
    density,
    align,
    auto,
    setRowAuto,
    changed,
    prefs,
    motif,
    fold,
  });

  const titled =
    title === undefined
      ? { path: undefined, control: undefined }
      : lift(title, loosePaths(resolved.group, ''));
  const list = (
    <PropertyList
      pack={gridPack}
      density={density}
      align={align}
      className={className ? `lk-control-panel ${className}` : 'lk-control-panel'}
    >
      {body(resolved.group, '', { pack, layout, grid: gridPack }, titled.path)}
    </PropertyList>
  );
  const panelFolds = collapsible ?? defaultCollapsed !== undefined;
  const panel =
    title === undefined &&
    !Object.values(appearance).some((v) => v !== undefined) &&
    !panelFolds ? (
      list
    ) : (
      <PropertyPanel
        className="lk-control-panel-frame"
        title={title}
        actions={titled.control}
        {...appearance}
        density={density}
        {...(panelFolds
          ? {
              collapsible: true,
              twisty,
              defaultCollapsed,
              collapsed: collapsed ? (collapsed[''] ?? defaultCollapsed ?? false) : undefined,
              onCollapsedChange: onCollapse ? (next: boolean) => onCollapse('', next) : undefined,
            }
          : {})}
      >
        {list}
      </PropertyPanel>
    );
  return (
    <PrefsSource source={prefs}>
      <FieldChoicesContext.Provider value={choices}>{panel}</FieldChoicesContext.Provider>
    </PrefsSource>
  );
}
