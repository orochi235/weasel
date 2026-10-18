import {
  isPrefLeaf,
  type PrefGroup,
  type PrefLeaf,
  type PrefSection,
  pairRuns,
  prefTabRuns,
} from '@weasel-js/prefs';
import {
  type CollapseProps,
  GroupTabs,
  type PrefFieldChoice,
  type PropertyAlign,
  type PropertyDensity,
  PropertyGroup,
  PropertyList,
  type PropertyListPack,
  Subpanel,
} from '@weasel-js/ui';
import { Fragment, type ReactNode } from 'react';
import { headingLeaf } from '../config/headingLeaf';
import { schemaNodeAtPath, valueAtPath } from '../config/path';
import type { ControlRenderer, ResolvedConfig, SectionSpec } from '../config/types';
import { isLeafEnabled, isLeafVisible } from '../config/visible';
import { ControlBar } from './ControlBar';
import { ControlRow } from './ControlRow';
import { type Rows, sectionRows } from './controlPack';
import { BareControl, extra, isSliderLeaf, labField } from './fields';
import { ResetGroup } from './ResetGroup';
import { PairedRow } from './rows';

const NO_CHOICES: readonly PrefFieldChoice[] = [];
const unwritten = (): void => {};

/** What a heading's fold takes: the grid its rows pack into, and how it opens. */
export interface FoldProps {
  pack: PropertyListPack;
  collapsible: boolean;
  twisty: CollapseProps['twisty'];
  defaultCollapsed: boolean;
  collapsed: boolean | undefined;
  onCollapsedChange: ((next: boolean) => void) | undefined;
}

/** What a lifted heading control reads and writes through. */
type LiftScope<TC extends Record<string, unknown>> = Pick<PanelRowsSource<TC>, 'resolved' | 'renderers' | 'shown' | 'setConfig'> & {
  visible: (path: string) => boolean;
  enabled: (path: string) => boolean;
};

/** The control a heading carries in its title row, lifted out of the rows
 *  beneath it — see `headingLeaf`. */
function liftedControl<TC extends Record<string, unknown>>(heading: ReactNode, paths: readonly string[], scope: LiftScope<TC>) {
  const { resolved, renderers, shown, setConfig, visible, enabled } = scope;
  const found = headingLeaf(resolved, heading, paths, renderers);
  if (!found) return { path: undefined, control: undefined };
  const { path, leaf } = found;
  return {
    path,
    control: visible(path) ? (
      <BareControl
        leaf={leaf}
        value={valueAtPath(shown, path) ?? extra<unknown>(leaf, 'default')}
        write={(value) => setConfig(path, value)}
        name={typeof heading === 'string' ? heading : undefined}
        disabled={!enabled(path)}
        read={(p) => valueAtPath(shown, p)}
      />
    ) : undefined,
  };
}

/** What a panel's rows are drawn from. */
export interface PanelRowsSource<TC extends Record<string, unknown>> {
  resolved: ResolvedConfig;
  config: TC;
  /** `config` with every auto path resolved. */
  shown: TC;
  setConfig: (path: string, value: unknown) => void;
  renderers: Record<string, ControlRenderer> | undefined;
  /** The schema the panel's aliases point into, where that is not `resolved`'s. */
  over: PrefGroup | PrefSection | undefined;
  showHidden: boolean;
  density: PropertyDensity | undefined;
  align: PropertyAlign | undefined;
  auto: ReadonlySet<string>;
  setRowAuto: (path: string, next: boolean, value: unknown) => void;
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
    renderers,
    over,
    showHidden,
    density,
    align,
    auto,
    setRowAuto,
    fold,
  } = source;

  const enabled = (path: string): boolean =>
    isLeafEnabled(resolved, path, config as Record<string, unknown>, over);
  const visible = (path: string): boolean =>
    isLeafVisible(resolved, path, config as Record<string, unknown>, showHidden, over);

  /** A group's paths that no section inside it claims, in schema order. */
  const loosePaths = (group: PrefGroup, at: string): string[] => {
    const sectioned = new Set(resolved.sections.filter((s) => s.at === at).flatMap((s) => s.paths));
    return Object.keys(group.children)
      .map((key) => (at === '' ? key : `${at}.${key}`))
      .filter((p) => !sectioned.has(p));
  };

  const lift = (heading: ReactNode, paths: readonly string[]) =>
    liftedControl(heading, paths, { resolved, renderers, shown, setConfig, visible, enabled });

  /** One node, which is either a group to recurse into or a row to draw. */
  const node = (path: string, rows: Rows): ReactNode => {
    const found = schemaNodeAtPath(resolved.group, path);
    if (!found) return null;
    if (!visible(path)) return null;
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
          renderers={renderers}
          pack={rows.pack}
          layout={rows.layout}
          auto={auto}
          setRowAuto={setRowAuto}
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
          value={(p, leaf) => valueAtPath(shown, p) ?? extra<unknown>(leaf, 'default')}
          read={(p) => valueAtPath(shown, p)}
          write={setConfig}
          custom={(p, leaf) => drawsOwn(resolved, renderers, p, leaf)}
          row={(p) => (
            <PropertyList pack={rows.grid} density={density} align={align}>
              {node(p, rows)}
            </PropertyList>
          )}
          open={(inner, at) => (
            <PropertyList pack={rows.grid} density={density} align={align}>
              {body(inner, at, rows)}
            </PropertyList>
          )}
        />
      );
    }
    // A group with no name contributes its rows and no chrome (core's rule for an empty
    // `PrefGroup.name`), and so does one named as the section it already sits under.
    if (found.name === '' || found.as === 'fragment' || found.name === rows.heading)
      return <Fragment key={path}>{body(found, path, rows)}</Fragment>;
    const lifted = lift(found.name, loosePaths(found, path));
    const reset = resolved.resettable?.has(path) ? (
      <ResetGroup
        group={found}
        path={path}
        config={config as Record<string, unknown>}
        setConfig={setConfig}
      />
    ) : undefined;
    // `as: 'section'` is a heading over the rows, with none of a group's frame.
    if (found.as === 'section') {
      const { pack: _pack, ...folds } = fold(path, undefined, rows.grid);
      return (
        <Subpanel key={path} title={found.name} {...folds}>
          {body(found, path, rows)}
        </Subpanel>
      );
    }
    return (
      <PropertyGroup
        key={path}
        title={found.name}
        description={found.description}
        // A nested group is a block of rows, not a control: half of a
        // two-column grid leaves it laying its own rows out inside a cell,
        // which overlaps them.
        span
        actions={
          lifted.control && reset ? (
            <>
              {lifted.control}
              {reset}
            </>
          ) : (
            (lifted.control ?? reset)
          )
        }
        {...fold(path, undefined, rows.grid)}
      >
        {body(found, path, rows, lifted.path)}
      </PropertyGroup>
    );
  };

  /**
   * The leaf at `path` if it may share a row with its neighbours: `pair` is
   * presentational, so a leaf whose control the lab draws itself, or one whose
   * control needs the whole row, keeps its own row instead.
   */
  const pairable = (path: string): readonly [path: string, leaf: PrefLeaf] | undefined => {
    const found = schemaNodeAtPath(resolved.group, path);
    if (!found || !isPrefLeaf(found)) return undefined;
    if (!visible(path)) return undefined;
    if (drawsOwn(resolved, renderers, path, found)) return undefined;
    // A cell is one bare control, so a leaf with no one field keeps its row.
    if (isSliderLeaf(found) || labField(found, undefined, unwritten, NO_CHOICES) === null)
      return undefined;
    return [path, found];
  };

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
        const tabs = step.tabs.flatMap((run) => run.items).filter(visible);
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
                content: (
                  <PropertyList pack={rows.grid} density={density} align={align}>
                    {body(group, path, rows)}
                  </PropertyList>
                ),
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
          layout={rows.layout}
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
          const inner = sectionRows(section, rows);
          const heading = lift(section.label, section.paths);
          return (
            <PropertyGroup
              key={sectionKey(section)}
              {...sectionFrame(section)}
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

/** Whether the lab or the instrument draws the control of the leaf at `path` itself: by path, in a dialog, or by kind. */
function drawsOwn(
  resolved: ResolvedConfig,
  renderers: Record<string, ControlRenderer> | undefined,
  path: string,
  leaf: PrefLeaf,
): boolean {
  const own =
    renderers?.[path] ??
    resolved.renderers[path] ??
    resolved.dialogs[path] ??
    renderers?.[leaf.kind];
  return own !== undefined;
}

/** What a section says of its own frame. */
function sectionFrame(section: SectionSpec): { title: string; className?: string } {
  return { title: section.label, className: section.className };
}

/** How a section is keyed for folding: its label at the root, and its group's
 *  path in front of it anywhere else, so two groups may both have an
 *  `Advanced`. */
function sectionKey(section: SectionSpec): string {
  return section.at === '' ? section.label : `${section.at}.${section.label}`;
}
