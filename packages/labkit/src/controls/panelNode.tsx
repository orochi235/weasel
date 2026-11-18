import { isPrefLeaf, type PrefGroup, type PrefLeaf } from '@weasel-js/prefs';
import { getOwn } from '@weasel-js/registry';
import { PropertyGroup, Subpanel } from '@weasel-js/ui/components/Properties';
import { Fragment, type ReactNode } from 'react';
import { drawsOwn } from '../config/drawsOwn';
import { configValueAt, schemaNodeAt } from '../config/path';
import { boundAction } from './boundAction';
import { ControlBar } from './ControlBar';
import { ControlRow } from './ControlRow';
import type { Rows } from './controlPack';
import { extra, leafValueAt } from './fields';
import { headingActions, type liftedControl } from './panelHeadings';
import type { PanelRowsSource } from './panelRows';
import { ResetGroup } from './ResetGroup';
import { PairedRow } from './rows';

/** A panel's source with what its conditions say of each path, fixed for one draw of its rows. */
export interface PanelScope<TC extends Record<string, unknown>> extends PanelRowsSource<TC> {
  enabled: (path: string) => boolean;
  visible: (path: string) => boolean;
  active: (path: string) => boolean;
}

/** The parts of a panel's drawing a node recurses into. */
export interface PanelDraw {
  /** `children` in a list packed as `rows` says. */
  list(rows: Rows, children: ReactNode): ReactNode;
  /** One node: a group to recurse into or a row to draw. */
  node(path: string, rows: Rows): ReactNode;
  /** One group's children; `lifted` is a loose leaf already drawn in its heading. */
  body(group: PrefGroup, at: string, rows: Rows, lifted?: string): ReactNode;
  /** A heading's control lifted into its title row. */
  lift(heading: ReactNode, paths: readonly string[]): ReturnType<typeof liftedControl>;
  loosePaths(group: PrefGroup, at: string): string[];
}

/** A leaf's row. */
function leafRow<TC extends Record<string, unknown>>(
  s: PanelScope<TC>,
  leaf: PrefLeaf,
  path: string,
  rows: Rows,
): ReactNode {
  return (
    <ControlRow
      key={path}
      path={path}
      leaf={leaf}
      resolved={s.resolved}
      config={s.config}
      shown={s.shown}
      setConfig={s.setConfig}
      draftConfig={s.draftConfig}
      error={s.errors && getOwn(s.errors, path)}
      renderers={s.renderers}
      pack={rows.pack}
      layout={rows.layout}
      auto={s.auto}
      setRowAuto={s.setRowAuto}
      changed={s.changed}
      disabled={!s.enabled(path)}
      over={s.over}
    />
  );
}

/** A group drawn `as: 'bar'`: its leaves as one strip of controls. */
function barRow<TC extends Record<string, unknown>>(
  s: PanelScope<TC>,
  draw: PanelDraw,
  group: PrefGroup,
  path: string,
  rows: Rows,
): ReactNode {
  return (
    <ControlBar
      key={path}
      group={group}
      path={path}
      visible={s.visible}
      enabled={s.enabled}
      active={s.active}
      value={(p, leaf) => leafValueAt(s.shown, p, leaf)}
      read={(p) => configValueAt(s.shown, p)}
      write={s.setConfig}
      bind={(leaf) => boundAction(leaf, s.config as Record<string, unknown>, s.setConfig)}
      draft={s.draftConfig}
      custom={(p, leaf) => drawsOwn(s.resolved, s.renderers, p, leaf)}
      row={(p) => draw.list(rows, draw.node(p, rows))}
      open={(inner, at) => draw.list(rows, draw.body(inner, at, rows))}
    />
  );
}

/** A named group: a section heading over its rows, or a framed `PropertyGroup`. */
function groupRow<TC extends Record<string, unknown>>(
  s: PanelScope<TC>,
  draw: PanelDraw,
  group: PrefGroup,
  path: string,
  rows: Rows,
): ReactNode {
  const lifted = draw.lift(group.name, draw.loosePaths(group, path));
  const reset = group.resettable ? (
    <ResetGroup group={group} path={path} source={s.prefs} />
  ) : undefined;
  // `as: 'section'` is a heading over the rows, unframed: the panel's motif doesn't reach it.
  if (group.as === 'section') {
    const { pack: _pack, ...folds } = s.fold(path, undefined, rows.grid);
    return (
      <Subpanel
        key={path}
        title={group.name}
        motif={s.resolved.motifs?.get(path)}
        disabled={!s.enabled(path)}
        {...folds}
      >
        {draw.body(group, path, rows)}
      </Subpanel>
    );
  }
  return (
    <PropertyGroup
      key={path}
      title={group.name}
      description={group.description}
      disabled={!s.enabled(path)}
      // A nested group is a block of rows, not a control: half of a
      // two-column grid leaves it laying its own rows out inside a cell,
      // which overlaps them.
      span
      motif={s.resolved.motifs?.get(path) ?? s.motif}
      actions={headingActions(lifted.control, reset)}
      {...s.fold(path, undefined, rows.grid)}
    >
      {draw.body(group, path, rows, lifted.path)}
    </PropertyGroup>
  );
}

/** One node at `path`, which is either a group to recurse into or a row to draw. */
export function nodeRow<TC extends Record<string, unknown>>(
  s: PanelScope<TC>,
  draw: PanelDraw,
  drawsAny: (path: string) => boolean,
  path: string,
  rows: Rows,
): ReactNode {
  const found = schemaNodeAt(s.resolved.group, path);
  if (!found) return null;
  if (!drawsAny(path)) return null;
  if (isPrefLeaf(found)) return leafRow(s, found, path, rows);
  if (found.as === 'bar') return barRow(s, draw, found, path, rows);
  // A group with no name contributes its rows and no chrome (core's rule for an empty
  // `PrefGroup.name`), and so does one named as the section it already sits under.
  if (found.name === '' || found.as === 'fragment' || found.name === rows.heading)
    return <Fragment key={path}>{draw.body(found, path, rows)}</Fragment>;
  return groupRow(s, draw, found, path, rows);
}

/** Leaves a `pair` joins, drawn on one row. */
export function pairedRow<TC extends Record<string, unknown>>(
  s: PanelScope<TC>,
  items: readonly string[],
  label: string,
  rows: Rows,
): ReactNode {
  const cells = items.map((path) => ({
    path,
    leaf: schemaNodeAt(s.resolved.group, path) as PrefLeaf,
    disabled: !s.enabled(path),
  }));
  return (
    <PairedRow
      key={items[0]}
      label={label}
      cells={cells}
      shown={s.shown}
      setConfig={s.setConfig}
      draftConfig={s.draftConfig}
      errors={s.errors}
      layout={rows.layout}
      changed={items.some((path) => s.changed?.has(path) === true)}
      // A segmented cell carries every choice at once, so a pair holding
      // one needs the whole row the way a segmented row of its own does.
      span={cells.some(({ leaf }) => extra<string>(leaf, 'control') === 'radio')}
    />
  );
}
