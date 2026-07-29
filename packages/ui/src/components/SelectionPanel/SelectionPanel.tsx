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
} from '@weasel-js/core';
import { ColorField } from '../ColorField';
import { Input } from '../Input';
import { NumberField } from '../NumberField';
import { Select } from '../Select';
import { Switch } from '../Switch';
import {
  MIXED,
  aggregateValue,
  classifyKind,
  effectiveSections,
  kindBreakdown,
  type AnyNode,
  type PanelLeaf,
} from './model';
import s from './SelectionPanel.module.css';

export interface PropertyRenderContext {
  /** Dotted node path of the leaf (`pose.x`, `data.fill`). */
  path: string;
  /** The schema leaf. App renderers narrow it to their own kind shape. */
  pref: ToolPrefLeaf;
  /** Aggregated value across the selection; `undefined` when mixed. */
  value: unknown;
  /** True when selected nodes disagree at this path. */
  mixed: boolean;
  /** Commit a value — fans out to every selected node in one undo step. */
  setValue: (value: unknown) => void;
}

export type PropertyRenderer = (ctx: PropertyRenderContext) => ReactNode;

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

/** Immutably set `value` at a dotted path within `root`, cloning each level
 *  on the way down so React sees new object identities. */
function setAtPath(root: object, segments: readonly string[], value: unknown): object {
  const [head, ...rest] = segments;
  if (rest.length === 0) return { ...root, [head]: value };
  const child = (root as Record<string, unknown>)[head];
  const childObj = child != null && typeof child === 'object' ? (child as object) : {};
  return { ...root, [head]: setAtPath(childObj, rest, value) };
}

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
    setValue: (v) => commit(panelLeaf, v),
  };

  const custom = renderers?.[path] ?? renderers?.[leaf.kind];
  if (custom) return custom(ctx);
  return renderBuiltin(ctx, ariaLabel);
}

function renderBuiltin(ctx: PropertyRenderContext, ariaLabel: string): ReactNode {
  const { pref, value, mixed, setValue } = ctx;
  switch (pref.kind) {
    case 'number': {
      const p = pref as ToolPrefNumber;
      const stored = typeof value === 'number' && Number.isFinite(value) ? value : undefined;
      const display = stored !== undefined ? (p.unit ? p.unit.toDisplay(stored) : stored) : NaN;
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
      // a title is the cheap honest cue for a mixed selection.
      if (!mixed) return control;
      return (
        <span className={s.mixedSwitch} title="Mixed">
          {control}
        </span>
      );
    }
    case 'enum': {
      const p = pref as ToolPrefEnum;
      return (
        <Select<string>
          className={s.select}
          options={p.options.map((o) => ({ value: o.value, label: o.label }))}
          selectedKey={mixed ? null : typeof value === 'string' ? value : p.default}
          placeholder={mixed ? 'Mixed' : undefined}
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
    default:
      return <span className={s.unrenderable}>({pref.kind}: no renderer)</span>;
  }
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
