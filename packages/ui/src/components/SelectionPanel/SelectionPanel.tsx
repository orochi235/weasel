import { useMemo, useState, useSyncExternalStore, type ReactNode } from 'react';
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
  type ToolPrefString,
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
  /** Per-kind control overrides / app-defined kinds (PrefsForm-style). */
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
  const sections = useMemo(
    () => effectiveSections(kinds, properties),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- kinds is
    // rebuilt per render; key on its content.
    [kinds.join(' '), properties],
  );

  if (nodes.length === 0) {
    return <div className={[s.root, className].filter(Boolean).join(' ')}>{emptyState}</div>;
  }

  const commit = (leaf: PanelLeaf, value: unknown): void => {
    const ids = selection.current.map(asNodeId);
    const dot = leaf.path.indexOf('.');
    const head = leaf.path.slice(0, dot);
    const key = leaf.path.slice(dot + 1);
    scene.batch(`Edit ${leaf.leaf.name}`, () => {
      for (const id of ids) {
        const node = scene.get(id);
        if (!node) continue;
        if (head === 'pose') {
          scene.setPose(id, { ...(node.pose as object), [key]: value } as TPose);
        } else if (head === 'data') {
          scene.update(id, { data: { ...(node.data as object), [key]: value } as TData });
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
      {sections.map((section) => (
        <section key={section.key} className={s.section}>
          {section.name !== '' && <h4 className={s.sectionTitle}>{section.name}</h4>}
          {section.rows.map((row) => (
            <div key={row.leaves[0].path} className={s.row}>
              <span className={s.rowLabel}>{row.label}</span>
              <span className={s.rowControls}>
                {row.leaves.map((panelLeaf) => (
                  <LeafControl
                    key={panelLeaf.path}
                    panelLeaf={panelLeaf}
                    nodes={nodes}
                    renderers={renderers}
                    commit={commit}
                  />
                ))}
              </span>
            </div>
          ))}
        </section>
      ))}
    </div>
  );
}

function LeafControl({
  panelLeaf,
  nodes,
  renderers,
  commit,
}: {
  panelLeaf: PanelLeaf;
  nodes: readonly AnyNode[];
  renderers?: Record<string, PropertyRenderer>;
  commit: (leaf: PanelLeaf, value: unknown) => void;
}) {
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

  const custom = renderers?.[leaf.kind];
  if (custom) return <>{custom(ctx)}</>;
  return <>{renderBuiltin(ctx)}</>;
}

function renderBuiltin(ctx: PropertyRenderContext): ReactNode {
  const { pref, value, mixed, setValue } = ctx;
  switch (pref.kind) {
    case 'number': {
      const p = pref as ToolPrefNumber;
      const stored = typeof value === 'number' && Number.isFinite(value) ? value : undefined;
      const display = stored !== undefined ? (p.unit ? p.unit.toDisplay(stored) : stored) : NaN;
      return (
        <NumberField
          className={s.number}
          value={mixed || stored === undefined ? NaN : display}
          placeholder={mixed ? 'Mixed' : undefined}
          minValue={p.min}
          maxValue={p.max}
          step={p.step ?? 1}
          hideSteppers
          aria-label={p.name}
          onChange={(n) => {
            if (Number.isNaN(n)) return;
            setValue(p.unit ? p.unit.fromDisplay(n) : n);
          }}
        />
      );
    }
    case 'string': {
      const p = pref as ToolPrefString;
      return (
        <DraftInput
          text={mixed ? undefined : typeof value === 'string' ? value : ''}
          placeholder={mixed ? 'Mixed' : undefined}
          ariaLabel={p.name}
          onCommit={setValue}
        />
      );
    }
    case 'boolean': {
      return (
        <Switch
          isSelected={Boolean(value)}
          onChange={setValue}
          aria-label={pref.name}
        />
      );
    }
    case 'enum': {
      const p = pref as ToolPrefEnum;
      return (
        <Select<string>
          className={s.select}
          options={p.options.map((o) => ({ value: o.value, label: o.label }))}
          selectedKey={mixed ? null : typeof value === 'string' ? value : p.default}
          placeholder="Mixed"
          onSelectionChange={setValue}
          aria-label={p.name}
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
          aria-label={p.name}
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
