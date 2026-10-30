import type { ReactNode } from 'react';
import type { IconRef } from '@weasel-js/icons';
import type { TrackShape } from '@weasel-js/geom';
import { applyPrefConditions, orderPrefGroup, prefAliasTargets, prefJudge, prefLeafValue, prefReader, prefValueAtPath, type PrefAlias, type PrefAliasTargets, type PrefBarLead, type PrefEntry, type PrefGroup, type PrefOrder, type PrefSection } from '@weasel-js/prefs';
import type { RunAlign } from '../Along/alongContext';
import type { LiveControl } from '../Prefs/commitPolicy';
import { entryApplier, type EntryAt } from '../Prefs/entry';
import { useParamsPolicy } from '../Prefs/useParamsPolicy';
import { paneChildren } from '../Prefs/PrefsPane';
import type { WalkCtx } from '../Prefs/PrefsRow';
import { prefFieldChoices, type PrefFieldChoice } from '../Prefs/schema';
import { PropertyList } from '../Properties/PropertyList';
import { PropertyRow } from '../Properties/PropertyRow';
import { pairRows } from '../SelectionPanel/model';
import { renderCells, type LeafCell } from '../SelectionPanel/cells';
import type { PropertyRenderContext, PropertyRenderer } from '../SelectionPanel/renderContext';
import { renderBuiltin } from '../SelectionPanel/renderLeaf';
import { barLeafName, BarLayout, groupBarNodes, shownBarNodes, type BarCell, type BarLeafNode, type BarOrientation, type BarOverflowMode } from './BarLayout';
import { childKeysAt } from './barOrder';
import { withBarLabel, type LeafSurface } from './renderBarLeaf';

/** Props for {@link Bar}. */
export interface BarProps {
  /**
   * What the bar holds, as a `PrefGroup`: a group's key is a segment of its
   * leaves' paths. A leaf is a cell. A nested `section` or `bar` is a run
   * between dividers, and a nested `page`, `tab`, or `panel` opens from a
   * button.
   */
  schema: PrefGroup;
  /** Each leaf's value, keyed by dotted path. A path with no entry shows its leaf's default, as a params surface does. */
  values?: Readonly<Record<string, unknown>>;
  /** A leaf edit, as the dotted path it was declared at and its new value. */
  onChange?: (path: string, value: unknown) => void;
  /** Paths whose sources disagree, drawn as the control's mixed state. */
  mixed?: ReadonlySet<string>;
  /** Control overrides, by dotted path or by leaf kind. */
  renderers?: Record<string, PropertyRenderer>;
  /** The schema this one's `alias` leaves point into. Default: this schema itself. A bar drawn from a schema of
   *  aliases into another passes that other: each alias is drawn as the leaf of it at the alias's path, reads and
   *  writes `values` at that path, and is hidden and disabled by that leaf's conditions as well as its own. A
   *  condition of this schema's own may read a setting of that one too: a path no leaf here holds is compared as
   *  the leaf of that schema there shows it: its entry in `values`, else its default. */
  over?: PrefGroup | PrefSection;
  /** Which way the bar runs. A vertical bar has no room beside a field, so
   *  every leaf but an action opens from a button. Default `'horizontal'`. */
  orientation?: BarOrientation;
  /** Names the bar and makes it a `toolbar`. Leave unset inside one. */
  label?: string;
  /** What the line starts with: `'label'` shows `label` ahead of the cells. Default: what `schema` says in its
   *  own `lead`, else nothing. `'icon'` shows `icon`. */
  lead?: PrefBarLead;
  /** The glyph `lead: 'icon'` starts the line with. Default: `schema`'s own `icon`. */
  icon?: IconRef;
  /** Draw the strip the bar sits on. Unset, the host's strip is under it. `'segmented'` is a compact strip
   *  whose buttons sit almost touching, so a run of actions reads as one control. */
  framed?: boolean | 'segmented';
  /** What happens to cells the line has no room for: `'scroll'` keeps them all on it, and `'menu'` opens the
   *  ones past its end from a button there. A `'menu'` bar asks for its natural length, its lead and every cell,
   *  sits at that length in a row sized to its content, folds cells into the menu only once squeezed shorter,
   *  and takes them back as room returns; it does not stretch to fill its host. Default: what `schema` says in
   *  its own `overflow`, else `'scroll'`. */
  overflow?: BarOverflowMode;
  /** What the button that opens the rest is called. Default `'More'`. */
  overflowLabel?: string;
  /** A track shape to lay the items along, each centered on its spot and tipped to it. On a curve every leaf but
   *  an action opens from a button, and `'menu'` puts the More button at the run's far end. `'scroll'` keeps an
   *  offset along the run, moved by wheel, drag or focus, and clips the run at the shape's ends. A line keeps the
   *  bar's flex line. Default: the nearest `Along`'s shape, else none. */
  shape?: TrackShape;
  /** Where a run shorter than its shape sits. Default: the nearest `Along`'s, else `'center'`. */
  align?: RunAlign;
  /** The order to draw in: each group's child keys, and each `actions` leaf's action keys, by container path (`''` is
   *  the top level). A key it leaves out takes its schema position, an action it leaves out goes at its run's end,
   *  and an unknown key is dropped. */
  order?: PrefOrder;
  /** Given, the bar marks its items and the buttons of its `actions` runs with `data-bar-unit` and `data-bar-in`, for
   *  a reorder gesture to move; it is called with the order that gesture settles on. */
  onReorder?: (order: PrefOrder) => void;
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
  const read = barReader(schema, values, props.over);
  const over = props.over ?? schema;
  const targets = prefAliasTargets(over, (entry) => prefJudge(over, read, entry));
  const judge = (entry?: PrefEntry) => prefJudge(schema, read, entry, props.over);
  const { shown, disabled } = applyPrefConditions(schema, judge(), { aliasOver: over, aliasHolds: targets.holds });
  const entryAt = entryApplier(judge);
  const { settles } = useParamsPolicy('panel');
  const draw: Draw = { values, mixed, renderers, onChange, fields, disabled, entryAt, targets, settles };
  return (
    <BarLayout
      nodes={shown === null ? [] : shownBarNodes(groupBarNodes(orderPrefGroup(shown, props.order), '', (group, path) => <GroupBody draw={draw} group={group} path={path} />, { values: read, onChange, over: props.over && 'children' in props.over ? props.over : schema }), (node) => shownNode(node, draw))}
      orientation={orientation}
      label={label}
      lead={props.lead ?? schema.lead}
      icon={props.icon ?? schema.icon}
      framed={framed}
      overflow={props.overflow ?? schema.overflow}
      overflowLabel={props.overflowLabel}
      shape={props.shape}
      align={props.align}
      order={props.order}
      onReorder={props.onReorder}
      keysOf={(container) => childKeysAt(orderPrefGroup(schema, props.order), container)}
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
  /** Paths of the leaves and fields a failed `enableIf` disables. */
  disabled: ReadonlySet<string>;
  /** Answers the conditions that read an entry of a list or a map, for that entry. */
  entryAt: EntryAt;
  /** The schema the bar's aliases point into, as its conditions leave it: what an alias is drawn from. */
  targets: PrefAliasTargets;
  settles: Readonly<Record<LiveControl, boolean>>;
}

/** `node` as the bar draws it: an alias as the leaf it shows, unless a renderer of the kind draws aliases itself. */
function shownNode(node: BarLeafNode, draw: Draw): BarLeafNode {
  if (node.leaf.kind !== 'alias' || draw.renderers?.alias) return node;
  const shown = draw.targets.shown(node.leaf as PrefAlias);
  return shown ? { path: node.path, at: shown.path, leaf: shown.leaf } : node;
}

/** The value a condition reads at `path`: the entry there, else the part of an entry above it that the rest of the path names. */
export function valueAt(values: Readonly<Record<string, unknown>> | undefined, path: string): unknown {
  if (values === undefined || Object.hasOwn(values, path)) return values?.[path];
  for (let dot = path.lastIndexOf('.'); dot > 0; dot = path.lastIndexOf('.', dot - 1)) {
    const head = path.slice(0, dot);
    if (Object.hasOwn(values, head)) return prefValueAtPath(values[head], path.slice(dot + 1));
  }
  return undefined;
}

/** What a bar over `schema` shows at `path`, as its conditions read it: the entry there ({@link valueAt}), else
 *  the default of the leaf of `schema` there, or of `over` where `schema` has none. */
export function barReader(
  schema: PrefGroup, values: Readonly<Record<string, unknown>> | undefined, over?: PrefGroup | PrefSection,
): (path: string) => unknown {
  const defaults = prefReader(schema, undefined, over);
  return (path) => {
    const held = valueAt(values, path);
    return held === undefined ? defaults(path) : held;
  };
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

function leafCell({ path: own, leaf, at }: BarLeafNode, surface: LeafSurface, draw: Draw): LeafCell {
  const { values, mixed, renderers, onChange, fields } = draw;
  const path = at ?? own;
  const isMixed = mixed?.has(path) === true;
  const shown = isMixed ? undefined : prefLeafValue(leaf, values?.[path]);
  const ctx: PropertyRenderContext = {
    path,
    pref: leaf,
    value: shown,
    mixed: isMixed,
    unset: !isMixed && shown === undefined,
    each: isMixed ? [] : [shown],
    setValue: (v) => onChange?.(path, v),
    // One set of values, so there is one prior value to derive from.
    update: (fn) => onChange?.(path, fn(shown)),
    valueAt: (p) => ({ value: values?.[p], mixed: mixed?.has(p) === true }),
    fields,
    disabled: draw.disabled.has(own),
    // The cell answers by the bar's own schema, at its own path; what is inside an alias's by its target's.
    disabledAt: at === undefined ? (under) => draw.disabled.has(under) : draw.targets.disabledAt,
    entryAt: at === undefined ? draw.entryAt : draw.targets.entryAt,
    settles: draw.settles,
  };
  return {
    key: own,
    leaf,
    ctx,
    ariaLabel: leaf.name,
    render: () => {
      const custom = renderers?.[own] ?? renderers?.[leaf.kind];
      if (!custom) return renderBuiltin(ctx, leaf.name, renderers, { selectionKey: own, surface });
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
    <PropertyRow key={path} label={barLeafName(leaf)} description={leaf.description} group disabled={draw.disabled.has(path)}>
      {control}
    </PropertyRow>
  );
}

/** `values`, each entry nested at its dotted path: a form's value tree. A deeper entry is written over a shallower one. */
function nested(values: Readonly<Record<string, unknown>> | undefined): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const path of Object.keys(values ?? {}).sort((a, b) => a.split('.').length - b.split('.').length)) {
    const segments = path.split('.');
    let at = out;
    for (const segment of segments.slice(0, -1)) {
      const next = at[segment];
      at = (at[segment] = next !== null && typeof next === 'object' ? { ...(next as Record<string, unknown>) } : {}) as Record<string, unknown>;
    }
    at[segments.at(-1)!] = values![path];
  }
  return out;
}

const ignore = (): void => {};

/** A group a bar opens from a button: its nested groups as a form's pane draws them, and its leaves as the bar's rows. */
function GroupBody({ draw, group, path }: { draw: Draw; group: PrefGroup; path: string }): ReactNode {
  const ctx: WalkCtx = {
    values: nested(draw.values),
    onChange: draw.onChange ?? ignore,
    mixed: draw.mixed,
    fields: draw.fields,
    targets: draw.targets,
    disabled: draw.disabled,
    entryAt: draw.entryAt,
    settles: draw.settles,
    leaves: {
      row: (node) => (node.leaf.hidden === true ? null : leafRow(shownNode(node, draw), draw)),
      cells: (leaves) => barCells(leaves, draw),
    },
  };
  return <PropertyList>{paneChildren(ctx, Object.entries(group.children), path, 1)}</PropertyList>;
}
