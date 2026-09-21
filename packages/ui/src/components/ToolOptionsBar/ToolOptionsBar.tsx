import type { ReactNode } from 'react';
import type { ToolPrefGroup, ToolPrefLeaf } from '@weasel-js/core';
import {
  renderBuiltin,
  renderCells,
  type LeafCell,
  type PropertyRenderContext,
  type PropertyRenderer,
} from '../SelectionPanel/renderLeaf';
import { isGroup, pairRows, type PanelLeaf, type PanelRow } from '../SelectionPanel/model';
import s from './ToolOptionsBar.module.css';

/** Props for {@link ToolOptionsBar}. */
export interface ToolOptionsBarProps {
  /**
   * Context label for the row — e.g. the active tool's name. Rendered
   * before the children and doubles as the toolbar's `aria-label`. Omit
   * it and the row still renders (it's a permanently reserved slot), just
   * without an accessible name.
   *
   * Using `label` for both the visible text and `aria-label` means a
   * screen reader announces it twice when landing on the toolbar ("Text,
   * toolbar", then "Text" again when browsing into the visible span).
   * `aria-labelledby` would avoid the echo at the cost of id plumbing and
   * an awkward no-`id`-to-point-at case when `label` is omitted. The
   * double-announcement is common enough for labeled landmark regions
   * that it's left as-is — considered, not missed.
   */
  label?: string;
  /**
   * The active tool's options. Leaves draw through the same leaf → control
   * mapping `SelectionPanel` uses, so a kind gets its control decided in one
   * place; groups organize without drawing, since the bar is one line.
   */
  schema?: ToolPrefGroup;
  /** Each leaf's value, keyed by dotted path. A path with no entry is unset. */
  values?: Readonly<Record<string, unknown>>;
  /** A leaf edit, as the dotted path it was declared at and its new value. */
  onChange?: (path: string, value: unknown) => void;
  /** Paths whose sources disagree — drawn as the control's mixed state. */
  mixed?: ReadonlySet<string>;
  /** Control overrides, by dotted path or by leaf kind, as the panel takes. */
  renderers?: Record<string, PropertyRenderer>;
  children?: ReactNode;
  className?: string;
}

/**
 * Horizontal strip reserved above the workspace for contextual tool options.
 * Given a `schema` it draws the active tool's options itself; the children
 * slot stays open for a tenant that is not a tool's options at all, such as
 * loupe controls.
 *
 * The row always renders, even empty, because the app reserves its height
 * permanently rather than mounting it on demand — mounting mid-edit would
 * resize the workspace under a canvas that's sized to the page.
 *
 * `role="toolbar"` without roving tabindex: the ARIA authoring practices
 * expect arrow-key roving focus across a toolbar's items, but a bar of
 * compound controls (`NumberField`, `Select`, `ColorField`) must leave the
 * arrow keys to them — they edit their own value with them. That is true of
 * schema-drawn controls as much as of arbitrary children, so the bar keeps
 * plain DOM tab order and `useRovingTabIndex` documents this as its opt-out.
 */
export function ToolOptionsBar(props: ToolOptionsBarProps) {
  const { label, schema, values, onChange, mixed, renderers, children, className } = props;
  const cls = [s.root, className].filter(Boolean).join(' ');
  return (
    <div className={cls} role="toolbar" aria-label={label}>
      {label !== undefined && <span className={s.label}>{label}</span>}
      <div className={s.controls}>
        {schema !== undefined &&
          barRows(schema).map((row) => (
            <BarRow
              key={row.leaves[0]!.path}
              row={row}
              values={values}
              mixed={mixed}
              renderers={renderers}
              onChange={onChange}
            />
          ))}
        {children}
      </div>
    </div>
  );
}

/**
 * The schema's visible leaves as rows, addressed by dotted path. Groups are
 * organizational here — a bar is one line, so a nested group contributes its
 * leaves and no chrome — but its path segment still names them, so a leaf
 * reads back at the path the tool declared it at.
 */
function barRows(schema: ToolPrefGroup): PanelRow[] {
  const leaves: PanelLeaf[] = [];
  const collect = (group: ToolPrefGroup, prefix: string): void => {
    for (const [key, child] of Object.entries(group.children)) {
      const path = prefix === '' ? key : `${prefix}.${key}`;
      if (isGroup(child)) collect(child, path);
      else if (child.hidden !== true) leaves.push({ path, leaf: child });
    }
  };
  collect(schema, '');
  return pairRows(leaves);
}

/** One row of the bar: a single control, or a run of flags as one bar. */
function BarRow({
  row,
  values,
  mixed,
  renderers,
  onChange,
}: {
  row: PanelRow;
  values: Readonly<Record<string, unknown>> | undefined;
  mixed: ReadonlySet<string> | undefined;
  renderers: Record<string, PropertyRenderer> | undefined;
  onChange: ((path: string, value: unknown) => void) | undefined;
}) {
  // The bar draws no row label, so a control carries its own name rather than
  // the panel's qualified "<pair> <leaf>" — the run's bar carries the pair.
  const cells = row.leaves.map((panelLeaf) =>
    barCell(panelLeaf, panelLeaf.leaf.name, values, mixed, renderers, onChange),
  );
  return (
    <>
      {renderCells(cells, renderers).map((cell) => (
        <span key={cell.key} className={s.cell}>
          {needsLabel(cell.leaf) && (
            <span className={s.cellLabel} aria-hidden="true">
              {cell.leaf.short ?? cell.leaf.name}
            </span>
          )}
          {cell.content}
        </span>
      ))}
    </>
  );
}

/**
 * Whether a control needs telling from its neighbours in words.
 *
 * Only a bare value box does: a number or a string is a box of characters,
 * and two of them side by side are indistinguishable. Everything else shows
 * what it is — a swatch is a color, a font picker names the family, a flag
 * run and a segmented control label their own segments — so a word in front
 * would repeat what the control already says. `name` stays the accessible
 * name either way, so this costs a screen reader nothing.
 */
function needsLabel(leaf: ToolPrefLeaf): boolean {
  return leaf.kind === 'number' || leaf.kind === 'string';
}

function barCell(
  panelLeaf: PanelLeaf,
  ariaLabel: string,
  values: Readonly<Record<string, unknown>> | undefined,
  mixed: ReadonlySet<string> | undefined,
  renderers: Record<string, PropertyRenderer> | undefined,
  onChange: ((path: string, value: unknown) => void) | undefined,
): LeafCell {
  const { path, leaf } = panelLeaf;
  const isMixed = mixed?.has(path) === true;
  const ctx: PropertyRenderContext = {
    path,
    pref: leaf,
    value: isMixed ? undefined : values?.[path],
    mixed: isMixed,
    unset: !isMixed && values?.[path] === undefined,
    setValue: (v) => onChange?.(path, v),
    valueAt: (p) => ({ value: values?.[p], mixed: mixed?.has(p) === true }),
  };
  return {
    key: path,
    leaf: leaf as ToolPrefLeaf,
    ctx,
    ariaLabel,
    render: () => {
      const custom = renderers?.[path] ?? renderers?.[leaf.kind];
      return custom ? custom(ctx) : renderBuiltin(ctx, ariaLabel, renderers, path);
    },
  };
}
