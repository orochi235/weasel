import type { ReactNode } from 'react';
import { isPrefLeaf, type PrefGroup, type PrefLeaf } from '@weasel-js/prefs';
import { prefFieldChoices, type PrefFieldChoice } from '../Prefs/schema';
import { PropertyList, PropertyRow } from '../Properties/PropertyPanel';
import { pairRows } from '../SelectionPanel/model';
import {
  renderBuiltin,
  renderCells,
  type LeafCell,
  type PropertyRenderContext,
  type PropertyRenderer,
} from '../SelectionPanel/renderLeaf';
import { BarLayout, groupBarNodes, type BarCell, type BarLeafNode, type BarOrientation } from './BarLayout';
import { withBarLabel, type LeafSurface } from './renderBarLeaf';
import s from './Bar.module.css';

/** Props for {@link Bar}. */
export interface BarProps {
  /**
   * What the bar holds, as a `PrefGroup`: a group's key is a segment of its
   * leaves' paths. A leaf is a cell. A nested `section` or `bar` is a run
   * between dividers, and a nested `page`, `tab`, or `panel` opens from a
   * button.
   */
  schema: PrefGroup;
  /** Each leaf's value, keyed by dotted path. A path with no entry is unset. */
  values?: Readonly<Record<string, unknown>>;
  /** A leaf edit, as the dotted path it was declared at and its new value. */
  onChange?: (path: string, value: unknown) => void;
  /** Paths whose sources disagree, drawn as the control's mixed state. */
  mixed?: ReadonlySet<string>;
  /** Control overrides, by dotted path or by leaf kind. */
  renderers?: Record<string, PropertyRenderer>;
  /** Which way the bar runs. A vertical bar has no room beside a field, so
   *  every leaf but an action opens from a button. Default `'horizontal'`. */
  orientation?: BarOrientation;
  /** Names the bar and makes it a `toolbar`. Leave unset inside one. */
  label?: string;
  /** Draw the strip the bar sits on. Unset, the host's strip is under it. */
  framed?: boolean;
  className?: string;
}

/**
 * A toolbar drawn from a schema: fields in their bar forms, actions as
 * buttons, in the order the group lists them. It has no frame of its own;
 * the host gives it the strip it sits on.
 */
export function Bar(props: BarProps) {
  const { schema, values, onChange, mixed, renderers, orientation, label, framed, className } = props;
  const fields = prefFieldChoices(schema);
  const draw: Draw = { values, mixed, renderers, onChange, fields };
  return (
    <BarLayout
      nodes={groupBarNodes(schema, '', (group, path) => <GroupRows draw={draw} group={group} path={path} />)}
      orientation={orientation}
      label={label}
      framed={framed}
      className={className}
      cells={(leaves) => barCells(leaves, draw)}
      row={(node) => <PropertyList>{leafRow(node, draw)}</PropertyList>}
    />
  );
}

interface Draw {
  values: Readonly<Record<string, unknown>> | undefined;
  mixed: ReadonlySet<string> | undefined;
  renderers: Record<string, PropertyRenderer> | undefined;
  onChange: ((path: string, value: unknown) => void) | undefined;
  fields: readonly PrefFieldChoice[];
}

/** Neighboring leaves as cells, a run of paired flags fused into one. */
function barCells(leaves: readonly BarLeafNode[], draw: Draw): BarCell[] {
  return pairRows(leaves).flatMap((row) => {
    // The bar draws no row label, so a control carries its own name rather than
    // the panel's qualified "<pair> <leaf>" — the run's bar carries the pair.
    const cells = row.leaves.map((node) => ({
      ...leafCell(node, 'bar', draw),
      ...(row.pair !== undefined ? { pair: { key: row.pair, label: row.label } } : {}),
    }));
    return renderCells(cells, draw.renderers).map((cell) => ({ path: cell.key, content: cell.content }));
  });
}

function leafCell({ path, leaf }: BarLeafNode, surface: LeafSurface, draw: Draw): LeafCell {
  const { values, mixed, renderers, onChange, fields } = draw;
  const isMixed = mixed?.has(path) === true;
  const ctx: PropertyRenderContext = {
    path,
    pref: leaf,
    value: isMixed ? undefined : values?.[path],
    mixed: isMixed,
    unset: !isMixed && values?.[path] === undefined,
    each: isMixed ? [] : [values?.[path]],
    setValue: (v) => onChange?.(path, v),
    // One set of values, so there is one prior value to derive from.
    update: (fn) => onChange?.(path, fn(isMixed ? undefined : values?.[path])),
    valueAt: (p) => ({ value: values?.[p], mixed: mixed?.has(p) === true }),
    fields,
  };
  return {
    key: path,
    leaf,
    ctx,
    ariaLabel: leaf.name,
    render: () => {
      const custom = renderers?.[path] ?? renderers?.[leaf.kind];
      if (!custom) return renderBuiltin(ctx, leaf.name, renderers, { selectionKey: path, surface });
      return surface === 'bar' ? withBarLabel(leaf, custom(ctx)) : custom(ctx);
    },
  };
}

/** A leaf as a labeled row, as a popover holds it. */
function leafRow(node: BarLeafNode, draw: Draw): ReactNode {
  const control = leafCell(node, 'row', draw).render();
  if (control == null) return null;
  const { leaf, path } = node;
  if (leaf.block) return <div key={path}>{control}</div>;
  return (
    <PropertyRow key={path} label={leaf.name} description={leaf.description} group>
      {control}
    </PropertyRow>
  );
}

/** A group a bar opens from a button: its leaves as rows, each nested group under its name. */
function GroupRows({ draw, group, path }: { draw: Draw; group: PrefGroup; path: string }): ReactNode {
  const rows: ReactNode[] = [];
  for (const [key, child] of Object.entries(group.children)) {
    const at = `${path}.${key}`;
    if (isPrefLeaf(child)) {
      if (child.hidden !== true) rows.push(leafRow({ path: at, leaf: child as PrefLeaf }, draw));
    } else {
      rows.push(
        <div key={at} className={s.opened}>
          {child.name !== '' && child.as !== 'fragment' && <h5 className={s.openedTitle}>{child.name}</h5>}
          <GroupRows draw={draw} group={child} path={at} />
        </div>,
      );
    }
  }
  return <PropertyList>{rows}</PropertyList>;
}
