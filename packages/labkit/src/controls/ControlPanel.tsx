import type { PrefGroup, PrefSection } from '@weasel-js/prefs';
import {
  type CollapseProps,
  type PropertyAlign,
  type PropertyDensity,
  PropertyList,
  type PropertyListPack,
  PropertyPanel,
  type PropertyRowLayout,
} from '@weasel-js/ui/components/Properties';
import type { StanceProps } from '@weasel-js/ui/stance';
import { type ReactNode, useMemo, useState } from 'react';
import { auto as autoValue } from '../config/auto';
import { resolveAutoConfig } from '../config/autoConfig';
import { fromConfigFields } from '../config/fromConfigField';
import type { ControlRenderer, ResolvedConfig } from '../config/types';
import { type ControlPack, gridOf } from './controlPack';
import { FieldChoicesContext, useFieldChoicesOf } from './fieldChoices';
import { panelRows } from './panelRows';
import type { ConfigField } from './types';

export type { ControlPack } from './controlPack';

/** Props for {@link ControlPanel}. */
export interface ControlPanelProps<TC extends Record<string, unknown>> extends StanceProps {
  /** The instrument's resolved config schema. */
  schema?: ResolvedConfig;
  /** @deprecated Pass `schema`. A field list is adapted into one internally. */
  fields?: ConfigField[];
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
  renderers?: Record<string, ControlRenderer>;
  /**
   * The schema this one's aliases point into. Default: this schema itself. A
   * panel drawn from a schema of aliases into another passes that other: each
   * alias row is drawn as the leaf of it at the alias's path, reads and writes
   * `config` at that path, and is hidden and disabled by that leaf's
   * conditions as well as its own. Those conditions read `config`, and that
   * schema's defaults where `config` holds nothing. A condition of this
   * schema's own may read a setting of that one the same way: hand
   * `resolveConfigSchema` that schema too, or it refuses the condition.
   */
  over?: PrefGroup | PrefSection;
  /** How rows pack into the two-column grid. Defaults to `'pairs'`. */
  pack?: ControlPack;
  /**
   * Where a row's label sits relative to its control. Unset takes each row's
   * own orientation — `block` (label above, which is what leaves a paired row
   * room for its value) for most, `inline` for colors and checkboxes.
   */
  layout?: PropertyRowLayout;
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
  /** Dotted paths currently unpinned. A row in this set hides its control and
   *  reads out `auto`, and clicking its label writes the sentinel back through
   *  `setConfig`. Omitted, the panel keeps the set itself: the labels still
   *  toggle and the sentinel never reaches `setConfig`, which would otherwise
   *  store it as the row's value. */
  auto?: ReadonlySet<string>;
  /** Draw leaves marked `hidden`. */
  showHidden?: boolean;
  /** Paths whose rows are marked as changed, as `PrefsForm`'s `changed` marks them: what differs from a
   *  default, or from what was last saved, is the caller's to say. A paired row is marked when any of its
   *  cells is named, and an alias row when the leaf it shows is. */
  changed?: ReadonlySet<string>;
  /** Heads the panel. With `title`, `stance` or `tone` given, or with the panel
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

const NO_AUTO: ReadonlySet<string> = new Set();

/**
 * Which rows are unpinned, and what hands one to its resolver or takes it
 * back. An owner that tracks the set decides what a dot means; one that does
 * not gets a panel that decides for itself, because the alternative is handing
 * it a sentinel it would write into the config as though it were a value.
 */
function usePanelAuto(
  given: ReadonlySet<string> | undefined,
  setConfig: (path: string, value: unknown) => void,
) {
  const [ownAuto, setOwnAuto] = useState<ReadonlySet<string>>(NO_AUTO);
  const setRowAuto = (path: string, next: boolean, value: unknown): void => {
    if (given) {
      setConfig(path, next ? autoValue : value);
      return;
    }
    setOwnAuto((prev) => {
      const now = new Set(prev);
      if (next) now.add(path);
      else now.delete(path);
      return now;
    });
    // Pinning keeps whatever the row was showing, the same value the controlled
    // path writes back.
    if (!next) setConfig(path, value);
  };
  return { auto: given ?? ownAuto, setRowAuto };
}

/** Render an instrument's config schema as a stack of controls, each writing
 *  back through `setConfig`. Built on the property rows, so a lab's controls
 *  are the same aligned, themed rows the rest of the kit uses. */
export function ControlPanel<TC extends Record<string, unknown>>({
  schema,
  fields,
  config,
  setConfig,
  draftConfig,
  errors,
  renderers,
  over,
  pack = 'pairs',
  layout,
  density,
  align,
  collapse,
  collapsed,
  onCollapse,
  collapsible,
  defaultCollapsed,
  twisty,
  auto: given,
  showHidden = false,
  changed,
  title,
  stance,
  tone,
  className,
}: ControlPanelProps<TC>) {
  const resolved = useMemo(() => schema ?? fromConfigFields(fields ?? []), [schema, fields]);
  const choices = useFieldChoicesOf(resolved.group);

  const { auto, setRowAuto } = usePanelAuto(given, setConfig);

  // What the instrument is reading. A row draws and reports from this rather
  // than calling its own resolver against the raw config, which would disagree
  // with the instrument whenever a resolver depends on another auto path.
  const shown = useMemo(
    () => (auto && auto.size > 0 ? resolveAutoConfig(resolved, config, auto) : config),
    [resolved, config, auto],
  );

  const gridPack = gridOf(pack);
  // A section that declares how it opens is foldable whether or not the lab
  // asked for folds — there is nothing else for the declaration to mean.
  const folds =
    collapse !== undefined ||
    collapsed !== undefined ||
    onCollapse !== undefined ||
    resolved.sections.some((s) => s.collapsed !== undefined);
  const startsFolded = collapse === 'closed';

  const fold = (key: string, declared?: boolean, grid: PropertyListPack = gridPack) => ({
    pack: grid,
    collapsible: folds,
    twisty,
    defaultCollapsed: declared ?? startsFolded,
    collapsed: collapsed ? (collapsed[key] ?? declared ?? startsFolded) : undefined,
    onCollapsedChange: onCollapse ? (next: boolean) => onCollapse(key, next) : undefined,
  });
  const { body, lift, loosePaths } = panelRows({
    resolved,
    config,
    shown,
    setConfig,
    draftConfig,
    errors,
    renderers,
    over,
    showHidden,
    density,
    align,
    auto,
    setRowAuto,
    changed,
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
    title === undefined && stance === undefined && tone === undefined && !panelFolds ? (
      list
    ) : (
      <PropertyPanel
        className="lk-control-panel-frame"
        title={title}
        actions={titled.control}
        stance={stance}
        tone={tone}
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
  return <FieldChoicesContext.Provider value={choices}>{panel}</FieldChoicesContext.Provider>;
}
