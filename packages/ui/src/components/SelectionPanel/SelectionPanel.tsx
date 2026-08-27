import { Fragment, useState, useSyncExternalStore, type ReactNode } from 'react';
import {
  asNodeId,
  type NodePropertiesEntry,
  type NodeRoutingEntry,
  type Scene,
  type SelectionApi,
  type ToolPrefColor,
  type ToolPrefEnum,
  type ToolPrefLeaf,
  type ToolPrefNumber,
  type ToolPrefPaint,
  type ToolPrefGroup,
  type ToolPrefObject,
} from '@weasel-js/core';
import { ColorField } from '../ColorField';
import { solidColorOf } from '../paintValue';
import { Input } from '../Input';
import { NumberField } from '../NumberField';
import { Select } from '../Select';
import { Switch } from '../Switch';
import { ToggleBar } from '../ToggleBar';
import { Icon } from '../../icons/Icon';
import { ICON_PATHS, type IconName } from '../../icons/paths';
import {
  MIXED,
  aggregateValue,
  classifyKind,
  effectiveSections,
  kindBreakdown,
  setAtPath,
  type AnyNode,
  type PanelLeaf,
} from './model';
import s from './SelectionPanel.module.css';

/** What a {@link PropertyRenderer} is given for the property it is rendering. */
export interface PropertyRenderContext {
  /** Dotted node path of the leaf (`pose.x`, `data.fill`). */
  path: string;
  /** The schema leaf. App renderers narrow it to their own kind shape. */
  pref: ToolPrefLeaf;
  /** Aggregated value across the selection; `undefined` when mixed or unset. */
  value: unknown;
  /** True when selected nodes disagree at this path. */
  mixed: boolean;
  /**
   * True when the nodes agree and what they agree on is nothing — the field
   * is absent, and whatever paints comes from a fallback further down.
   *
   * Distinct from `mixed`, and both leave `value` undefined. A control must
   * not substitute its schema default here: doing so shows a value the node
   * does not hold, and the next edit writes that invention back.
   */
  unset: boolean;
  /** Commit a value — fans out to every selected node in one undo step. */
  setValue: (value: unknown) => void;
  /**
   * The aggregated value at another node path — what `value` and `mixed` are
   * for this leaf's own path, for any path.
   *
   * A control whose subject spans more than one field needs it: a font picker
   * reporting which variant will actually paint has to read the node's weight
   * and style. Reading it off `value` is impossible — a leaf is handed one
   * field.
   */
  valueAt: (path: string) => { value: unknown; mixed: boolean };
}

/**
 * Renders the control for one property across the whole selection.
 * Returning `null` collapses the leaf.
 */
export type PropertyRenderer = (ctx: PropertyRenderContext) => ReactNode;

/** Props for {@link SelectionPanel}. */
export interface SelectionPanelProps<TData, TLayer extends string, TPose> {
  /** The scene handle (`useScene`). The panel subscribes itself, so it
   *  re-renders on scene mutations regardless of parent renders. */
  scene: Scene<TData, TLayer, TPose>;
  /** Selection handle (`useSelection`). Only `current` is read. */
  selection: Pick<SelectionApi, 'current'>;
  /** Properties-trait entries, e.g. core's `defaultNodeProperties` /
   *  `inferredNodeProperties` (+ consumer extras). Memoize or hoist. */
  properties: readonly NodePropertiesEntry[];
  /** Routing-trait classifiers used to derive each node's kind — pass
   *  the same list the canvas uses. Memoize or hoist. */
  routing: readonly NodeRoutingEntry[];
  /** Control overrides / app-defined kinds (PrefsForm-style). Keys are
   *  leaf paths (`data.fill`, checked first) or leaf kinds (`color`).
   *  A renderer returning `null` collapses its leaf (and the row, when
   *  every leaf in it collapses). */
  renderers?: Record<string, PropertyRenderer>;
  /** Kind → header label. Default: capitalized kind name. */
  kindLabel?: (kind: string) => string;
  /** Rendered when the selection is empty. */
  emptyState?: ReactNode;
  className?: string;
}

const defaultKindLabel = (kind: string): string =>
  kind.length === 0 ? kind : kind[0].toUpperCase() + kind.slice(1);

/**
 * Pre-baked selection properties panel. Shows the selected nodes' kind
 * and the properties-trait schema for that kind; multi-selections show
 * the intersection of the kinds' schemas with per-field Mixed state.
 * Edits commit as one labeled `scene.batch` fan-out per gesture.
 */
export function SelectionPanel<TData, TLayer extends string, TPose>(
  props: SelectionPanelProps<TData, TLayer, TPose>,
) {
  const {
    scene,
    selection,
    properties,
    routing,
    renderers,
    kindLabel = defaultKindLabel,
    emptyState = null,
    className,
  } = props;

  useSyncExternalStore(scene.subscribe, scene.getVersion, scene.getVersion);

  const nodes = selection.current
    .map((id) => scene.get(asNodeId(id)))
    .filter((n): n is NonNullable<typeof n> => n != null) as readonly AnyNode[];

  const kinds = nodes.map((n) => classifyKind(n, routing));
  const sections = effectiveSections(kinds, properties);

  if (nodes.length === 0) {
    return <div className={[s.root, className].filter(Boolean).join(' ')}>{emptyState}</div>;
  }

  const commit = (leaf: PanelLeaf, value: unknown): void => {
    const [head, ...rest] = leaf.path.split('.');
    if (rest.length === 0) return;
    const ids = selection.current.map(asNodeId);
    scene.batch(`Edit ${leaf.leaf.name}`, () => {
      for (const id of ids) {
        const node = scene.get(id);
        if (!node) continue;
        // `setAtPath` spreads plain objects/arrays down the schema path;
        // consumer `pose`/`data` are assumed plain-object-shaped along
        // that path (a class instance's prototype would be dropped by
        // the spread) — the `as TPose`/`as TData` casts below rely on it.
        if (head === 'pose') {
          scene.setPose(id, setAtPath(node.pose as object, rest, value) as TPose);
        } else if (head === 'data') {
          scene.update(id, { data: setAtPath(node.data as object, rest, value) as TData });
        }
      }
    });
  };

  return (
    <div className={[s.root, className].filter(Boolean).join(' ')}>
      <header className={s.header}>
        {nodes.length === 1 ? (
          <span className={s.kind}>{kindLabel(kinds[0])}</span>
        ) : (
          <>
            <span className={s.kind}>{nodes.length} selected</span>
            <span className={s.breakdown}>{kindBreakdown(kinds)}</span>
          </>
        )}
      </header>
      {sections.map((section) => {
        // Render controls before emitting row chrome so a null-rendering
        // leaf (custom renderer opting out) collapses its cell — and the
        // whole row / section when nothing survives. PrefsForm precedent.
        const rows = section.rows
          .map((row) => {
            const controls = row.leaves
              .map((panelLeaf) => ({
                panelLeaf,
                content: renderLeafControl(
                  panelLeaf,
                  row.leaves.length > 1
                    ? `${row.label} ${panelLeaf.leaf.name}`
                    : panelLeaf.leaf.name,
                  nodes,
                  renderers,
                  commit,
                ),
              }))
              .filter((c) => c.content != null);
            return { row, controls };
          })
          .filter(({ controls }) => controls.length > 0);
        if (rows.length === 0) return null;
        return (
          <section key={section.key} className={s.section}>
            {section.name !== '' && <h3 className={s.sectionTitle}>{section.name}</h3>}
            {rows.map(({ row, controls }) => (
              // A `block` leaf brings its own chrome — it spans the section
              // instead of sitting in a labeled row's control cell.
              row.leaves.length === 1 && row.leaves[0].leaf.block ? (
                <div key={row.leaves[0].path}>{controls[0].content}</div>
              ) : (
              <div key={row.leaves[0].path} className={s.row}>
                <span className={s.rowLabel} title={row.leaves[0].leaf.description}>
                  {row.label}
                </span>
                <span className={s.rowControls}>
                  {controls.map(({ panelLeaf, content }) => (
                    <Fragment key={panelLeaf.path}>{content}</Fragment>
                  ))}
                </span>
              </div>
              )
            ))}
          </section>
        );
      })}
    </div>
  );
}

function renderLeafControl(
  panelLeaf: PanelLeaf,
  ariaLabel: string,
  nodes: readonly AnyNode[],
  renderers: Record<string, PropertyRenderer> | undefined,
  commit: (leaf: PanelLeaf, value: unknown) => void,
): ReactNode {
  const { path, leaf } = panelLeaf;
  const aggregated = aggregateValue(nodes, path);
  const mixed = aggregated === MIXED;
  const value = mixed ? undefined : aggregated;

  const ctx: PropertyRenderContext = {
    path,
    pref: leaf,
    value,
    mixed,
    unset: !mixed && aggregated === undefined,
    setValue: (v) => commit(panelLeaf, v),
    valueAt: (p) => {
      const at = aggregateValue(nodes, p);
      return at === MIXED ? { value: undefined, mixed: true } : { value: at, mixed: false };
    },
  };

  const custom = renderers?.[path] ?? renderers?.[leaf.kind];
  if (custom) return custom(ctx);
  return renderBuiltin(ctx, ariaLabel, renderers);
}

function renderBuiltin(
  ctx: PropertyRenderContext,
  ariaLabel: string,
  renderers?: Record<string, PropertyRenderer>,
): ReactNode {
  const { pref, value, mixed, unset, setValue } = ctx;
  switch (pref.kind) {
    case 'number': {
      const p = pref as ToolPrefNumber;
      const stored = typeof value === 'number' && Number.isFinite(value) ? value : undefined;
      const display = stored !== undefined ? (p.unit ? p.unit.toDisplay(stored) : stored) : NaN;
      if (p.control === 'slider') {
        const min = p.min ?? 0;
        const max = p.max ?? 100;
        const known = !mixed && stored !== undefined;
        return (
          <>
            <input
              type="range"
              className={s.slider}
              style={{
                ['--slider-fill' as string]:
                  `${known && max > min ? ((Math.min(Math.max(display, min), max) - min) / (max - min)) * 100 : 0}%`,
              }}
              min={min}
              max={max}
              step={p.step ?? 1}
              // The thumb clamps to the track; the readout beside it does not,
              // so a value past `max` is still reported as what it is.
              value={known ? Math.min(Math.max(display, min), max) : min}
              disabled={mixed}
              aria-label={ariaLabel}
              onChange={(e) => {
                const next = Number(e.target.value);
                setValue(p.unit ? p.unit.fromDisplay(next) : next);
              }}
            />
            <span className={s.sliderReadout} aria-hidden="true">
              {known ? `${display}${p.unit?.suffix ?? ''}` : '—'}
            </span>
          </>
        );
      }
      const field = (
        <NumberField
          className={s.number}
          value={mixed || stored === undefined ? NaN : display}
          placeholder={mixed ? 'Mixed' : undefined}
          minValue={p.min}
          maxValue={p.max}
          step={p.step ?? 1}
          hideSteppers
          aria-label={ariaLabel}
          onChange={(n) => {
            if (Number.isNaN(n)) return;
            setValue(p.unit ? p.unit.fromDisplay(n) : n);
          }}
        />
      );
      if (p.unit?.suffix === undefined) return field;
      return (
        <>
          {field}
          <span className={s.unitSuffix} aria-hidden="true">
            {p.unit.suffix}
          </span>
        </>
      );
    }
    case 'string': {
      return (
        <DraftInput
          text={mixed ? undefined : typeof value === 'string' ? value : ''}
          placeholder={mixed ? 'Mixed' : undefined}
          ariaLabel={ariaLabel}
          onCommit={setValue}
        />
      );
    }
    case 'boolean': {
      const control = (
        <Switch isSelected={Boolean(value)} onChange={setValue} aria-label={ariaLabel} />
      );
      // Switch has no indeterminate state; a reduced-opacity wrapper with
      // a title is the cheap honest cue for a mixed selection, and for a
      // field the node leaves to its fallback.
      if (!mixed && !unset) return control;
      return (
        <span className={s.mixedSwitch} title={mixed ? 'Mixed' : 'Not set'}>
          {control}
        </span>
      );
    }
    case 'enum': {
      const p = pref as ToolPrefEnum;
      if (p.control === 'toggle') {
        // Every option visible at once, which is the point of a segmented
        // control: a glyph, else `short`, keeps it to the width a property row
        // has, and the full label stays the accessible name. A mixed selection
        // selects nothing rather than picking a winner.
        return (
          <ToggleBar<string>
            size="sm"
            variant="flat"
            className={s.toggle}
            ariaLabel={ariaLabel}
            items={p.options.map((o) => ({
              value: o.value,
              label:
                o.icon && o.icon in ICON_PATHS ? (
                  <Icon name={o.icon as IconName} size={14} />
                ) : (
                  (o.short ?? o.label)
                ),
              ariaLabel: o.label,
            }))}
            value={mixed || unset ? null : (typeof value === 'string' ? value : p.default)}
            onChange={(next) => { if (next !== null) setValue(next); }}
          />
        );
      }
      return (
        <Select<string>
          className={s.select}
          options={p.options.map((o) => ({ value: o.value, label: o.label }))}
          selectedKey={mixed || unset ? null : typeof value === 'string' ? value : p.default}
          placeholder={mixed ? 'Mixed' : unset ? '—' : undefined}
          onSelectionChange={setValue}
          aria-label={ariaLabel}
        />
      );
    }
    case 'color': {
      const p = pref as ToolPrefColor;
      return (
        <ColorField
          value={mixed ? undefined : typeof value === 'string' ? value : p.default}
          mixed={mixed}
          alpha={p.alpha}
          onChange={setValue}
          aria-label={ariaLabel}
        />
      );
    }
    case 'paint': {
      // The value is a whole `FillStyle`. A solid one has a color to show; a
      // pattern or gradient does not, and showing the control's default there
      // would claim a color the shape doesn't have. It gets the same
      // indeterminate chip a genuinely mixed selection gets — in both cases
      // the honest statement is "there is no single color here".
      const p = pref as ToolPrefPaint;
      const solid = solidColorOf(value) ?? (mixed ? undefined : solidColorOf(p.default));
      return (
        <ColorField
          value={mixed ? undefined : solid}
          mixed={mixed || (value !== undefined && solidColorOf(value) === undefined)}
          alpha={p.alpha}
          // Write the whole union member. Setting a `color` key on the
          // existing paint would leave a `{ fill: 'linear-gradient', stops,
          // color }` hybrid that every structural `'color' in paint` check
          // downstream reads as solid.
          onChange={(color) => setValue({ fill: 'solid', color })}
          aria-label={ariaLabel}
        />
      );
    }
    case 'object': {
      // One value with fields hanging off it. Each child writes the parent
      // whole, so a field is never set on a half-built object.
      return <ObjectLeaf ctx={ctx} renderers={renderers} />;
    }
    default:
      return <span className={s.unrenderable}>({pref.kind}: no renderer)</span>;
  }
}

/**
 * Renders an object leaf: a titled block whose rows are the object's own
 * fields. A child's edit commits the parent object, never the child's path —
 * writing into a path whose value is not an object yet would corrupt it.
 */
/** One labeled row inside an object leaf; `pair` merges adjacent fields into
 *  it, exactly as the section rows merge theirs. */
interface ObjectRow {
  key: string;
  pair?: string;
  label: string;
  title?: string;
  /** Every field in the row brought its own chrome, so the row drops the
   *  label column and spans the block. One unlabeled field in an otherwise
   *  labeled pair would leave the row named after half of itself. */
  block: boolean;
  controls: ReactNode[];
}

/**
 * Renders an object leaf: the object's own fields, as rows. A child's edit
 * commits the parent object, never the child's path — writing into a path
 * whose value is not an object yet would corrupt it.
 */
function ObjectLeaf({
  ctx,
  renderers,
}: {
  ctx: PropertyRenderContext;
  renderers?: Record<string, PropertyRenderer>;
}): ReactNode {
  const pref = ctx.pref as ToolPrefObject;
  const held = typeof ctx.value === 'object' && ctx.value !== null
    ? (ctx.value as Record<string, unknown>)
    : undefined;

  // A value whose fields are entirely grouped is titled by those groups — its
  // own heading would stack onto the first one and name nothing new.
  const allGrouped = Object.values(pref.children).every((child) => !('kind' in child));

  // `indent` is false when nothing visible sits above these rows: depth is
  // drawn only where a label marks it.
  const rowsOf = (
    children: Record<string, ToolPrefLeaf | ToolPrefGroup>,
    indent: boolean,
  ): ReactNode[] => {
    const out: (ReactNode | ObjectRow)[] = [];
    for (const [key, child] of Object.entries(children)) {
      // A group among the children organises the fields under a heading
      // without contributing to the path — the rule group keys follow at the
      // top level.
      if (!('kind' in child)) {
        const labeled = child.name !== '';
        const inner = rowsOf(child.children, labeled);
        if (inner.length === 0) continue;
        out.push(
          <div key={`group:${key}`} className={labeled && indent ? s.objectGroup : undefined}>
            {labeled && <h5 className={s.sectionTitle}>{child.name}</h5>}
            {inner}
          </div>,
        );
        continue;
      }
      const childPath = `${ctx.path}.${key}`;
      const childCtx: PropertyRenderContext = {
        path: childPath,
        pref: child,
        value: held?.[key],
        mixed: ctx.mixed,
        // A field of an object the node does not hold is unset, and so is one
        // the object omits — `data.stroke` absent leaves every stroke field
        // with nothing behind it, not with the schema's defaults.
        unset: !ctx.mixed && held?.[key] === undefined,
        valueAt: ctx.valueAt,
        setValue: (v) => {
          const base = held ?? pref.fromScalar?.(ctx.value) ?? {};
          ctx.setValue({ ...base, [key]: v });
        },
      };
      const custom = renderers?.[childPath] ?? renderers?.[child.kind];
      const rendered = custom ? custom(childCtx) : renderBuiltin(childCtx, child.name, renderers);
      if (rendered == null) continue;
      // A paired row spends its label on the pair, so a field in one is named
      // only by its glyph. The control already carries `name` as its
      // accessible name, which leaves the glyph decorative.
      const glyph = child.pair !== undefined && child.icon && child.icon in ICON_PATHS;
      const content = glyph ? (
        <span className={s.namedField}>
          <Icon name={child.icon as IconName} size={14} />
          {rendered}
        </span>
      ) : (
        rendered
      );
      const prev = out[out.length - 1];
      const isRow = (v: ReactNode | ObjectRow): v is ObjectRow =>
        typeof v === 'object' && v !== null && 'controls' in v;
      if (child.pair !== undefined && isRow(prev) && prev.pair === child.pair) {
        prev.controls.push(<Fragment key={childPath}>{content}</Fragment>);
        prev.block &&= child.block === true;
        continue;
      }
      out.push({
        key: childPath,
        pair: child.pair,
        label: child.pair ?? child.name,
        title: child.description,
        block: child.block === true,
        controls: [<Fragment key={childPath}>{content}</Fragment>],
      });
    }
    return out.map((entry) =>
      typeof entry === 'object' && entry !== null && 'controls' in entry ? (
        entry.block ? (
          <div key={entry.key} className={`${s.rowControls} ${s.blockRow}`} title={entry.title}>
            {entry.controls}
          </div>
        ) : (
          <div key={entry.key} className={s.row}>
            <span className={s.rowLabel} title={entry.title}>{entry.label}</span>
            <span className={s.rowControls}>{entry.controls}</span>
          </div>
        )
      ) : (
        entry
      ),
    );
  };

  const rows = rowsOf(pref.children, !allGrouped);
  if (rows.length === 0) return null;
  return (
    <div className={s.objectLeaf}>
      {!allGrouped && <h4 className={s.sectionTitle}>{pref.name}</h4>}
      {rows}
    </div>
  );
}

/** Text input with commit-on-blur/Enter semantics — live-per-keystroke
 *  writes would emit one undo step per character. */
function DraftInput({
  text,
  placeholder,
  ariaLabel,
  onCommit,
}: {
  text: string | undefined;
  placeholder?: string;
  ariaLabel: string;
  onCommit: (v: string) => void;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  return (
    <Input
      value={draft ?? text ?? ''}
      placeholder={placeholder}
      aria-label={ariaLabel}
      onChange={setDraft}
      onBlur={() => {
        if (draft !== null && draft !== text) onCommit(draft);
        setDraft(null);
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
      }}
    />
  );
}
