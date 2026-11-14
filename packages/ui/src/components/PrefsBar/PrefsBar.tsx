import type { ReactNode } from 'react';
import { applyPrefConditions, orderPrefGroup, prefAliasTargets, prefJudge, prefLeafValue, prefReader, prefValueAtPath, createRecordSource, createValuesSource, type PrefAlias, type PrefAliasTargets, type PrefEntry, type PrefGroup, type PrefSection } from '@weasel-js/prefs';
import type { LiveControl } from '../Prefs/commitPolicy';
import { entryApplier, type EntryAt } from '../Prefs/entry';
import { useParamsPolicy } from '../Prefs/useParamsPolicy';
import { paneChildren } from '../Prefs/PrefsPane';
import type { WalkCtx } from '../Prefs/PrefsRow';
import { prefFieldChoices, type PrefFieldChoice } from '../Prefs/schema';
import { PropertyList } from '../Properties/PropertyList';
import { PropertyRow } from '../Properties/PropertyRow';
import type { LeafCell } from '../inspector/SelectionPanel/cells';
import type { LeafContext, LeafRenderer } from '../inspector/SelectionPanel/renderContext';
import { renderBuiltin } from '../inspector/SelectionPanel/renderLeaf';
import { Bar, type BarProps } from '../Bar/Bar';
import { childKeysAt } from '../Bar/barOrder';
import { withBarLabel } from '../Bar/renderBarLeaf';
import { drawsBarForm, type ControlForm } from '../ActionButton/controlForm';
import { barCells as cellsOf } from './barCells';
import { barLeafName, barNodeChildren, groupBarNodes, shownBarNodes, type BarCell, type BarLeafNode } from './barNodes';

/** Props for {@link PrefsBar}: a `Bar`'s, but for its children, which the schema draws. */
export interface PrefsBarProps extends Omit<BarProps, 'children' | 'keysOf'> {
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
  renderers?: Record<string, LeafRenderer>;
  /** The schema this one's `alias` leaves point into. Default: this schema itself. A bar drawn from a schema of
   *  aliases into another passes that other: each alias is drawn as the leaf of it at the alias's path, reads and
   *  writes `values` at that path, and is hidden and disabled by that leaf's conditions as well as its own. A
   *  condition of this schema's own may read a setting of that one too: a path no leaf here holds is compared as
   *  the leaf of that schema there shows it: its entry in `values`, else its default. */
  over?: PrefGroup | PrefSection;
  /** Cells drawn after the schema's, on the same line. */
  children?: ReactNode;
}

/**
 * A `Bar` drawn from a schema: fields in their bar forms, actions as
 * buttons, in the order the group lists them, then its own children. It has
 * no frame of its own unless `framed`; the host gives it the strip it sits on.
 *
 * Inside a curved `Along` each item is centered on its spot and tipped to it, every leaf but an action opens from a
 * button, and `'menu'` puts the More button at the run's far end; `'scroll'` keeps an offset along the run, moved by
 * wheel, drag or focus, and clips the run at the shape's ends.
 */
export function PrefsBar(props: PrefsBarProps) {
  const { schema, values, onChange, mixed, renderers, over: overProp, children, ...bar } = props;
  const fields = prefFieldChoices(schema);
  const read = barReader(schema, values, overProp);
  const over = overProp ?? schema;
  const targets = prefAliasTargets(over, (entry) => prefJudge(over, read, entry));
  const judge = (entry?: PrefEntry) => prefJudge(schema, read, entry, overProp);
  const { shown, disabled, active } = applyPrefConditions(schema, judge(), { aliasOver: over, aliasHolds: targets.holds });
  const entryAt = entryApplier(judge);
  const { settles, textWaitMs } = useParamsPolicy('panel');
  const draw: Draw = { values, mixed, renderers, onChange, fields, disabled, active, entryAt, targets, settles, textWaitMs };
  const open = (group: PrefGroup, path: string) => <GroupBody draw={draw} group={group} path={path} />;
  const menu = { values: read, onChange, over: overProp && 'children' in overProp ? overProp : schema };
  const nodes = shown === null ? [] : shownBarNodes(groupBarNodes(orderPrefGroup(shown, props.order), '', open, menu), (node) => shownNode(node, draw));
  return (
    <Bar
      {...bar}
      lead={props.lead ?? schema.lead}
      icon={props.icon ?? schema.icon}
      overflow={props.overflow ?? schema.overflow}
      keysOf={(container) => childKeysAt(orderPrefGroup(schema, props.order), container)}
    >
      {barNodeChildren(nodes, { cells: (leaves) => barCells(leaves, draw) })}
      {children}
    </Bar>
  );
}

interface Draw {
  values: Readonly<Record<string, unknown>> | undefined;
  mixed: ReadonlySet<string> | undefined;
  renderers: Record<string, LeafRenderer> | undefined;
  onChange: ((path: string, value: unknown) => void) | undefined;
  fields: readonly PrefFieldChoice[];
  /** Paths of the leaves and fields a failed `enableIf` disables. */
  disabled: ReadonlySet<string>;
  /** Paths of the actions whose `activeIf` holds. */
  active: ReadonlySet<string>;
  /** Answers the conditions that read an entry of a list or a map, for that entry. */
  entryAt: EntryAt;
  /** The schema the bar's aliases point into, as its conditions leave it: what an alias is drawn from. */
  targets: PrefAliasTargets;
  settles: Readonly<Record<LiveControl, boolean>>;
  textWaitMs: number;
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
  return cellsOf(leaves, (node) => leafCell(node, 'bar', draw), draw.renderers);
}

function leafCell({ path: own, leaf, at }: BarLeafNode, surface: ControlForm, draw: Draw): LeafCell {
  const { values, mixed, renderers, onChange, fields } = draw;
  const path = at ?? own;
  const isMixed = mixed?.has(path) === true;
  const shown = isMixed ? undefined : prefLeafValue(leaf, values?.[path]);
  const ctx: LeafContext = {
    path,
    pref: leaf,
    value: shown,
    mixed: isMixed,
    unset: !isMixed && shown === undefined,
    each: isMixed ? [] : [shown],
    setValue: (v) => onChange?.(path, v),
    // One set of values, so there is one prior value to derive from.
    update: (fn) => onChange?.(path, fn(shown)),
    source: createRecordSource({ [path]: leaf }, values, onChange, { mixed }),
    setAuto: () => {},
    fields,
    disabled: draw.disabled.has(own),
    // The cell answers by the bar's own schema, at its own path; what is inside an alias's by its target's.
    disabledAt: at === undefined ? (under) => draw.disabled.has(under) : draw.targets.disabledAt,
    ...(draw.active.has(own) ? { active: true } : {}),
    entryAt: at === undefined ? draw.entryAt : draw.targets.entryAt,
    settles: draw.settles,
    textWaitMs: draw.textWaitMs,
  };
  return {
    key: own,
    leaf,
    ctx,
    ariaLabel: leaf.name,
    render: () => {
      const custom = renderers?.[own] ?? renderers?.[leaf.kind];
      if (!custom) return renderBuiltin(ctx, leaf.name, renderers, { selectionKey: own, surface });
      return drawsBarForm(surface) ? withBarLabel(leaf, custom(ctx)) : custom(ctx);
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
    <PropertyRow key={path} label={barLeafName(leaf)} description={leaf.description} group disabled={draw.disabled.has(path)} disabledReason={leaf.disabledReason}>
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
  const values = nested(draw.values);
  const onChange = draw.onChange ?? ignore;
  const ctx: WalkCtx = {
    // The bar draws its own leaves: the source answers only what the pane's groups ask of it.
    source: createValuesSource(group, () => values, onChange, { mixed: draw.mixed }),
    values,
    onChange,
    mixed: draw.mixed,
    fields: draw.fields,
    targets: draw.targets,
    disabled: draw.disabled,
    active: draw.active,
    entryAt: draw.entryAt,
    settles: draw.settles,
    textWaitMs: draw.textWaitMs,
    leaves: {
      row: (node) => (node.leaf.hidden === true ? null : leafRow(shownNode(node, draw), draw)),
      cells: (leaves) => barCells(leaves, draw),
    },
  };
  return <PropertyList>{paneChildren(ctx, Object.entries(group.children), path, 1)}</PropertyList>;
}
