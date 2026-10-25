import {
  isPrefLeaf,
  type PrefGroup,
  type PrefLeaf,
  type PrefSection,
  pairRuns,
  prefTabRuns,
} from '@weasel-js/prefs';
import type { Motif } from '@weasel-js/ui/components/MotifFrame';
import { GroupTabs } from '@weasel-js/ui/components/Prefs';
import {
  type CollapseProps,
  type PropertyAlign,
  type PropertyDensity,
  PropertyGroup,
  PropertyList,
  type PropertyListPack,
  Subpanel,
} from '@weasel-js/ui/components/Properties';
import { Fragment, type ReactNode } from 'react';
import { schemaNodeAtPath, valueAtPath } from '../config/path';
import type { ControlRenderer, ResolvedConfig } from '../config/types';
import { isLeafEnabled, isLeafVisible } from '../config/visible';
import { boundAction } from './boundAction';
import { ControlBar } from './ControlBar';
import { ControlRow } from './ControlRow';
import { type Rows, sectionRows } from './controlPack';
import { extra, leafValueAt } from './fields';
import { headingActions, liftedControl, sectionFrame, sectionKey } from './panelHeadings';
import { drawsAnyAt, drawsOwn, loosePathsIn, pairableAt } from './panelPaths';
import { ResetGroup } from './ResetGroup';
import { PairedRow } from './rows';

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
  renderers: Record<string, ControlRenderer> | undefined;
  /** The schema the panel's aliases point into, where that is not `resolved`'s. */
  over: PrefGroup | PrefSection | undefined;
  showHidden: boolean;
  density: PropertyDensity | undefined;
  align: PropertyAlign | undefined;
  auto: ReadonlySet<string>;
  setRowAuto: (path: string, next: boolean, value: unknown) => void;
  /** Paths whose rows are marked as changed. */
  changed?: ReadonlySet<string>;
  /** The motif each group and section is drawn in where it names none of its own. */
  motif?: Motif;
  /** The fold of the heading keyed `key`, which starts as `declared` says. */
  fold: (key: string, declared: boolean | undefined, grid: PropertyListPack) => FoldProps;
}

/**
 * A panel's schema as rows: each group's loose nodes, then its sections, a
 * heading's control lifted into its title row, paired leaves on one row, and
 * a run of tabs as one strip.
 */
export function panelRows<TC extends Record<string, unknown>>(source: PanelRowsSource<TC>) {
  const {
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
  } = source;

  const enabled = (path: string): boolean =>
    isLeafEnabled(resolved, path, config as Record<string, unknown>, over);
  const visible = (path: string): boolean =>
    isLeafVisible(resolved, path, config as Record<string, unknown>, showHidden, over);

  const listOf = (rows: Rows, children: ReactNode): ReactNode => (
    <PropertyList pack={rows.grid} density={density} align={align}>
      {children}
    </PropertyList>
  );

  const drawsAny = (path: string): boolean => drawsAnyAt(resolved, visible, path);
  const loosePaths = (group: PrefGroup, at: string): string[] => loosePathsIn(resolved, group, at);

  const lift = (heading: ReactNode, paths: readonly string[]) =>
    liftedControl(heading, paths, { ...source, visible, enabled });

  /** One node, which is either a group to recurse into or a row to draw. */
  const node = (path: string, rows: Rows): ReactNode => {
    const found = schemaNodeAtPath(resolved.group, path);
    if (!found) return null;
    if (!drawsAny(path)) return null;
    if (isPrefLeaf(found)) {
      return (
        <ControlRow
          key={path}
          path={path}
          leaf={found}
          resolved={resolved}
          config={config}
          shown={shown}
          setConfig={setConfig}
          draftConfig={draftConfig}
          error={errors?.[path]}
          renderers={renderers}
          pack={rows.pack}
          layout={rows.layout}
          auto={auto}
          setRowAuto={setRowAuto}
          changed={changed}
          disabled={!enabled(path)}
          over={over}
        />
      );
    }
    if (found.as === 'bar') {
      return (
        <ControlBar
          key={path}
          group={found}
          path={path}
          visible={visible}
          enabled={enabled}
          value={(p, leaf) => leafValueAt(shown, p, leaf)}
          read={(p) => valueAtPath(shown, p)}
          write={setConfig}
          bind={(leaf) => boundAction(leaf, config as Record<string, unknown>, setConfig)}
          draft={draftConfig}
          custom={(p, leaf) => drawsOwn(resolved, renderers, p, leaf)}
          row={(p) => listOf(rows, node(p, rows))}
          open={(inner, at) => listOf(rows, body(inner, at, rows))}
        />
      );
    }
    // A group with no name contributes its rows and no chrome (core's rule for an empty
    // `PrefGroup.name`), and so does one named as the section it already sits under.
    if (found.name === '' || found.as === 'fragment' || found.name === rows.heading)
      return <Fragment key={path}>{body(found, path, rows)}</Fragment>;
    const lifted = lift(found.name, loosePaths(found, path));
    const reset = resolved.resettable?.has(path) ? (
      <ResetGroup {...{ group: found, path, config, setConfig }} />
    ) : undefined;
    // `as: 'section'` is a heading over the rows, unframed: the panel's motif doesn't reach it.
    if (found.as === 'section') {
      const { pack: _pack, ...folds } = fold(path, undefined, rows.grid);
      return (
        <Subpanel
          key={path}
          title={found.name}
          motif={resolved.motifs?.get(path)}
          disabled={!enabled(path)}
          {...folds}
        >
          {body(found, path, rows)}
        </Subpanel>
      );
    }
    return (
      <PropertyGroup
        key={path}
        title={found.name}
        description={found.description}
        disabled={!enabled(path)}
        // A nested group is a block of rows, not a control: half of a
        // two-column grid leaves it laying its own rows out inside a cell,
        // which overlaps them.
        span
        motif={resolved.motifs?.get(path) ?? source.motif}
        actions={headingActions(lifted.control, reset)}
        {...fold(path, undefined, rows.grid)}
      >
        {body(found, path, rows, lifted.path)}
      </PropertyGroup>
    );
  };

  const pairable = (path: string) => pairableAt(resolved, renderers, visible, path);

  /** A run of sibling paths as rows, merging each leaf a `pair` names into
   *  the row of the leaf naming it, where they run adjacent. */
  const rowsFor = (paths: readonly string[], rows: Rows): ReactNode[] => {
    const runs = pairRuns(paths, pairable);
    // A run of groups drawn as tabs shares one strip. A group is never paired, so each is a run of its own.
    const tabGroup = ({ items: [only], pair }: (typeof runs)[number]): boolean => {
      const found = pair || only === undefined ? undefined : schemaNodeAtPath(resolved.group, only);
      return found !== undefined && !isPrefLeaf(found) && found.as === 'tab';
    };
    const out: ReactNode[] = [];
    for (const step of prefTabRuns(runs, tabGroup)) {
      if (step.tabs) {
        const tabs = step.tabs.flatMap((run) => run.items).filter(drawsAny);
        if (tabs.length === 0) continue;
        out.push(
          <GroupTabs
            key={step.tabs[0]?.items[0]}
            className="lk-control-tabs"
            tabs={tabs.map((path) => {
              const group = schemaNodeAtPath(resolved.group, path) as PrefGroup;
              return {
                id: path,
                name: group.name,
                disabled: !enabled(path),
                content: listOf(rows, body(group, path, rows)),
              };
            })}
          />,
        );
        continue;
      }
      const { items, pair } = step.item;
      if (!pair) {
        for (const path of items) out.push(node(path, rows));
        continue;
      }
      const cells = items.map((path) => ({
        path,
        leaf: schemaNodeAtPath(resolved.group, path) as PrefLeaf,
        disabled: !enabled(path),
      }));
      out.push(
        <PairedRow
          key={items[0]}
          label={pair.label}
          cells={cells}
          shown={shown}
          setConfig={setConfig}
          draftConfig={draftConfig}
          errors={errors}
          layout={rows.layout}
          changed={items.some((path) => changed?.has(path) === true)}
          // A segmented cell carries every choice at once, so a pair holding
          // one needs the whole row the way a segmented row of its own does.
          span={cells.some(({ leaf }) => extra<string>(leaf, 'control') === 'radio')}
        />,
      );
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
          loosePaths(group, at).filter((p) => p !== lifted),
          rows,
        )}
        {sections.map((section) => {
          if (!section.paths.some(drawsAny)) return null;
          const inner = sectionRows(section, rows);
          const heading = lift(section.label, section.paths);
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

  return { body, lift, loosePaths };
}
