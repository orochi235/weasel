/**
 * The rows a run of an object leaf's fields draws: one labeled row a field,
 * with the fields of a `pair` sharing theirs.
 */
import { Fragment, type ReactNode } from 'react';
import { HiddenBadge, hiddenAttrs } from '../Prefs/hidden';
import { selectionAttrs } from '../Prefs/selection';
import { renderCells, type LeafCell, type RenderedCell } from './cells';
import { LabeledRow } from './LabeledRow';
import type { PropertyRenderer } from './renderContext';
import type { PanelMarks } from './selection';
import s from './SelectionPanel.module.css';

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
  /** Every field in the row is disabled. */
  disabled: boolean;
  /** Every field in the row is one a `showIf` hides. */
  hidden: boolean;
  controls: ReactNode[];
}

/** Rendered cells as rows: a run of adjacent same-`pair` fields shares one. */
function pairedRows(rendered: readonly RenderedCell[]): ObjectRow[] {
  const rows: ObjectRow[] = [];
  for (const { key, leaf, block, disabled, hidden, content, pair } of rendered) {
    const prev = rows[rows.length - 1];
    if (pair !== undefined && prev?.pair === pair.key) {
      prev.controls.push(<Fragment key={key}>{content}</Fragment>);
      prev.block &&= block;
      prev.disabled &&= disabled;
      prev.hidden &&= hidden;
      continue;
    }
    rows.push({
      key,
      ...(pair ? { pair: pair.key } : {}),
      label: pair?.label ?? leaf.name,
      title: leaf.description,
      block,
      disabled,
      hidden,
      controls: [<Fragment key={key}>{content}</Fragment>],
    });
  }
  return rows;
}

/**
 * The rows of a run of neighboring fields. A section between two fields ends
 * the run, since it ends the cells this is handed. `leafHidden` is whether the
 * object leaf itself is hidden.
 */
export function objectFieldRows(
  cells: readonly LeafCell[],
  renderers: Record<string, PropertyRenderer> | undefined,
  marks: PanelMarks,
  leafHidden: boolean,
): ReactNode[] {
  // A row several fields share is drawn for its first.
  const attrs = (entry: ObjectRow) => selectionAttrs(entry.key, marks, true);
  // The leaf's own mark covers its fields; a row hidden on its own carries one.
  const marked = (entry: ObjectRow): boolean => entry.hidden && !leafHidden;
  return pairedRows(renderCells(cells, renderers)).map((entry) =>
    entry.block ? (
      <div key={entry.key} className={`${s.rowControls} ${s.blockRow}`} title={entry.title} {...attrs(entry)} {...hiddenAttrs(marked(entry))}>
        {marked(entry) && <HiddenBadge lead />}
        {entry.controls}
      </div>
    ) : (
      <LabeledRow key={entry.key} label={entry.label} title={entry.title} marked={marked(entry)} disabled={entry.disabled}
        attrs={{ ...attrs(entry), ...hiddenAttrs(marked(entry)) }}>
        {entry.controls}
      </LabeledRow>
    ),
  );
}
