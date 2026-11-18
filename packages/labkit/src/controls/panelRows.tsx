import {
  isPrefLeaf,
  type PrefGroup,
  type PrefSection,
  type PrefsSource,
  pairRuns,
  prefTabRuns,
} from '@weasel-js/prefs';
import type { Motif } from '@weasel-js/ui/components/MotifFrame';
import { GroupTabs } from '@weasel-js/ui/components/Prefs';
import {
  type CollapseProps,
  type PropertyAlign,
  PropertyGroup,
  PropertyList,
  type PropertyListPack,
  type PropertySpacing,
  PropertySpan,
} from '@weasel-js/ui/components/Properties';
import type { ReactNode } from 'react';
import { schemaNodeAt } from '../config/path';
import type { LeafRenderer, ResolvedConfig } from '../config/types';
import { isRowActive, isRowEnabled, isRowVisible } from '../config/visible';
import { type Rows, sectionRows } from './controlPack';
import { liftedControl, sectionFrame, sectionKey } from './panelHeadings';
import { nodeRow, type PanelDraw, type PanelScope, pairedRow } from './panelNode';
import { drawsAnyAt, loosePathsIn, pairableAt } from './panelPaths';

/** What a heading's fold takes: the grid its rows pack into, and how it opens. */
export interface FoldProps {
  pack: PropertyListPack;
  collapsible: boolean;
  twisty: CollapseProps['twisty'];
  defaultCollapsed: boolean;
  collapsed: boolean | undefined;
  onCollapsedChange: ((next: boolean) => void) | undefined;
}

/** What a panel's rows are drawn from. */
export interface PanelRowsSource<TC extends Record<string, unknown>> {
  resolved: ResolvedConfig;
  config: TC;
  /** `config` with every auto path resolved. */
  shown: TC;
  setConfig: (path: string, value: unknown) => void;
  draftConfig: ((path: string, value: unknown) => void) | undefined;
  errors: Readonly<Record<string, ReactNode>> | undefined;
  renderers: Record<string, LeafRenderer> | undefined;
  /** The schema the panel's aliases point into, where that is not `resolved`'s. */
  over: PrefGroup | PrefSection | undefined;
  showHidden: boolean;
  spacing: PropertySpacing | undefined;
  align: PropertyAlign | undefined;
  auto: ReadonlySet<string>;
  setRowAuto: (path: string, next: boolean, value: unknown) => void;
  /** Paths whose rows are marked as changed. */
  changed?: ReadonlySet<string>;
  /** Where the panel's leaves are read and reset. */
  prefs: PrefsSource;
  /** The motif each group and section is drawn in where it names none of its own. */
  motif?: Motif;
  /** The fold of the heading keyed `key`, which starts as `declared` says. */
  fold: (key: string, declared: boolean | undefined, grid: PropertyListPack) => FoldProps;
}

/** What the panel's conditions say of the node at a path: whether it takes input, is drawn, and is drawn pressed. */
function conditionsAt<TC extends Record<string, unknown>>({
  resolved,
  config,
  showHidden,
  over,
}: PanelRowsSource<TC>) {
  const values = config as Record<string, unknown>;
  return {
    enabled: (path: string): boolean => isRowEnabled(resolved, path, values, over),
    visible: (path: string): boolean => isRowVisible(resolved, path, values, showHidden, over),
    active: (path: string): boolean => isRowActive(resolved, path, values, over),
  };
}

/**
 * A panel's schema as rows: each group's loose nodes, then its sections, a
 * heading's control lifted into its title row, paired leaves on one row, and
 * a run of tabs as one strip.
 */
export function panelRows<TC extends Record<string, unknown>>(source: PanelRowsSource<TC>) {
  const { resolved, renderers, spacing, align, fold } = source;
  const scope: PanelScope<TC> = { ...source, ...conditionsAt(source) };
  const { enabled, visible } = scope;

  const drawsAny = (path: string): boolean => drawsAnyAt(resolved, visible, path);
  const pairable = (path: string) => pairableAt(resolved, renderers, visible, path);

  const draw: PanelDraw = {
    list: (rows, children) => (
      <PropertyList pack={rows.grid} spacing={spacing} align={align}>
        {children}
      </PropertyList>
    ),
    node: (path, rows) => nodeRow(scope, draw, drawsAny, path, rows),
    body: (group, at, rows, lifted) => body(group, at, rows, lifted),
    lift: (heading, paths) => liftedControl(heading, paths, scope),
    loosePaths: (group, at) => loosePathsIn(resolved, group, at),
  };

  /** A run of sibling paths as rows, merging each leaf a `pair` names into
   *  the row of the leaf naming it, where they run adjacent. */
  const rowsFor = (paths: readonly string[], rows: Rows): ReactNode[] => {
    const runs = pairRuns(paths, pairable);
    // A run of groups drawn as tabs shares one strip. A group is never paired, so each is a run of its own.
    const tabGroup = ({ items: [only], pair }: (typeof runs)[number]): boolean => {
      const found = pair || only === undefined ? undefined : schemaNodeAt(resolved.group, only);
      return found !== undefined && !isPrefLeaf(found) && found.as === 'tab';
    };
    const out: ReactNode[] = [];
    for (const step of prefTabRuns(runs, tabGroup, ({ items }) => items.some(drawsAny))) {
      if (step.tabs) {
        const tabs = step.tabs.flatMap((run) => run.items);
        const group = (path: string) => schemaNodeAt(resolved.group, path) as PrefGroup;
        const content = (found: PrefGroup, path: string) =>
          draw.list(rows, body(found, path, rows));
        out.push(controlTabs(step.tabs[0]?.items[0], tabs, { group, enabled, content }));
        continue;
      }
      const { items, pair } = step.item;
      if (pair) out.push(pairedRow(scope, items, pair.label, rows));
      else for (const path of items) out.push(draw.node(path, rows));
    }
    return out;
  };

  /** One group's children: its loose nodes, then its sections. `lifted` is a
   *  loose leaf already drawn in the group's heading. */
  const body = (group: PrefGroup, at: string, rows: Rows, lifted?: string): ReactNode => {
    const sections = resolved.sections.filter((s) => s.at === at);
    return (
      <>
        {rowsFor(
          draw.loosePaths(group, at).filter((p) => p !== lifted),
          rows,
        )}
        {sections.map((section) => {
          if (!section.paths.some(drawsAny)) return null;
          const inner = sectionRows(section, rows);
          const heading = draw.lift(section.label, section.paths);
          return (
            <PropertyGroup
              key={sectionKey(section)}
              {...sectionFrame(section, source.motif)}
              actions={heading.control}
              {...fold(sectionKey(section), section.collapsed, inner.grid)}
            >
              {rowsFor(
                section.paths.filter((p) => p !== heading.path),
                inner,
              )}
            </PropertyGroup>
          );
        })}
      </>
    );
  };

  return { body, lift: draw.lift, loosePaths: draw.loosePaths };
}

/** A run of groups drawn as tabs: one strip of their names, each dimmed while its group is disabled. */
function controlTabs(
  key: string | undefined,
  paths: readonly string[],
  at: {
    group: (path: string) => PrefGroup;
    enabled: (path: string) => boolean;
    content: (group: PrefGroup, path: string) => ReactNode;
  },
): ReactNode {
  return (
    <PropertySpan key={key}>
      <GroupTabs
        className="lk-control-tabs"
        tabs={paths.map((path) => {
          const group = at.group(path);
          return {
            id: path,
            name: group.name,
            disabled: !at.enabled(path),
            content: at.content(group, path),
          };
        })}
      />
    </PropertySpan>
  );
}
