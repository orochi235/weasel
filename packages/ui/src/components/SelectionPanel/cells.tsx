/**
 * A row's leaves as cells, with nothing rendered until the run a leaf belongs
 * to is known: that is what turns a row of paired toggles into one segmented
 * bar.
 */
import type { ReactNode } from 'react';
import type { PrefBoolean, PrefLeaf } from '@weasel-js/prefs';
import { prefDrawsNoControl } from '../Prefs/PrefWords';
import { prefFieldProps } from '../Prefs/prefField';
import { FitLabel, labelForms } from '../FitLabel/FitLabel';
import type { PropertyBooleanFieldProps } from '../Properties/PropertyField';
import { ToggleBar } from '../ToggleBar';
import { perNodeState } from './leafField';
import type { PropertyRenderContext, PropertyRenderer } from './renderContext';
import s from './SelectionPanel.module.css';

/**
 * One leaf with its context built but nothing rendered yet.
 *
 * Deferring the render is what lets a run of sibling flags become one bar:
 * whether a leaf joins its neighbors is a fact about the run, which no leaf
 * rendering itself can see.
 */
export interface LeafCell {
  key: string;
  leaf: PrefLeaf;
  ctx: PropertyRenderContext;
  /** The accessible name this leaf's control carries — qualified by the row's
   *  pair where the row holds more than one leaf. */
  ariaLabel: string;
  /** Renders the leaf on its own, chrome and all. */
  render: () => ReactNode;
  /** The paired row the leaf shares, by the path that declared it and what it reads. */
  pair?: { key: string; label: string };
}

/** A cell's content, once the run it belongs to has been decided. */
export interface RenderedCell {
  key: string;
  /** The leaf that names the cell — the run's first, for a flag bar. */
  leaf: PrefLeaf;
  block: boolean;
  /** Every leaf the cell draws is disabled. */
  disabled: boolean;
  content: ReactNode;
  pair?: { key: string; label: string };
}

/**
 * True for a leaf that can join a flag bar: a paired toggle boolean the
 * consumer has not claimed with a renderer of its own.
 */
export function isFlagCell(cell: LeafCell, renderers?: Record<string, PropertyRenderer>): boolean {
  const { leaf } = cell;
  return (
    leaf.kind === 'boolean' &&
    (leaf as PrefBoolean).control === 'toggle' &&
    cell.pair !== undefined &&
    renderers?.[cell.ctx.path] === undefined &&
    renderers?.[leaf.kind] === undefined
  );
}

/**
 * Renders a row's cells, collapsing each run of adjacent same-`pair` toggle
 * booleans into one segmented bar — the idiom the enum toggle a row away
 * already uses, rather than one detached pill per flag.
 */
export function renderCells(
  cells: readonly LeafCell[],
  renderers?: Record<string, PropertyRenderer>,
): RenderedCell[] {
  const out: RenderedCell[] = [];
  for (let i = 0; i < cells.length; ) {
    const cell = cells[i];
    if (!isFlagCell(cell, renderers)) {
      const content = cell.render();
      if (content != null) {
        out.push({ key: cell.key, leaf: cell.leaf, block: cell.leaf.block === true || prefDrawsNoControl(cell.leaf), disabled: cell.ctx.disabled === true, content, ...(cell.pair ? { pair: cell.pair } : {}) });
      }
      i += 1;
      continue;
    }
    let j = i + 1;
    while (
      j < cells.length &&
      isFlagCell(cells[j], renderers) &&
      cells[j].pair?.key === cell.pair?.key
    ) {
      j += 1;
    }
    const run = cells.slice(i, j);
    out.push({
      key: cell.key,
      leaf: cell.leaf,
      block: run.every((c) => c.leaf.block === true),
      disabled: run.every((c) => c.ctx.disabled === true),
      content: <FlagBar run={run} ariaLabel={cell.pair?.label ?? cell.leaf.name} />,
      ...(cell.pair ? { pair: cell.pair } : {}),
    });
    i = j;
  }
  return out;
}

/**
 * A run of paired boolean flags as one multi-select bar — U / S / O, the way
 * every text editor draws them.
 */
function FlagBar({ run, ariaLabel }: { run: readonly LeafCell[]; ariaLabel: string }): ReactNode {
  // Each flag through the same field props a lone one gets, so an `encoding`
  // (Italic stored as `fontStyle`) reads and writes the same way in a bar.
  const flags = run.map((c) => {
    const field = prefFieldProps(c.leaf, {
      value: c.ctx.value,
      mixed: c.ctx.mixed,
      unset: c.ctx.unset,
      siblings: c.ctx.siblings,
      setValue: c.ctx.setValue,
      disabled: c.ctx.disabled,
      ...perNodeState(c.ctx),
    }) as PropertyBooleanFieldProps;
    return { cell: c, field };
  });
  const on = flags.filter((f) => !f.field.mixed && f.field.value === true).map((f) => f.cell.key);
  return (
    <ToggleBar<string>
      mode="multiple"
      size="sm"
      variant="flat"
      className={s.flagToggle}
      ariaLabel={ariaLabel}
      items={flags.map(({ cell, field }) => ({
        value: cell.key,
        label: field.glyph ?? <FitLabel forms={labelForms(cell.leaf.name, field.short)} />,
        ariaLabel: cell.ariaLabel,
        tooltip: field.glyph === undefined ? undefined : cell.leaf.name,
        disabled: field.disabled,
      }))}
      value={on}
      // Each flag owns its own path, so only the segment that moved is
      // written — committing the run would write two fields nobody touched,
      // and inside an object leaf would fabricate values for the other two.
      mixedValues={flags.filter((f) => f.field.mixed).map((f) => f.cell.key)}
      onChange={(next) => {
        for (const { cell, field } of flags) {
          const now = next.includes(cell.key);
          if (now !== on.includes(cell.key)) field.onChange(now);
        }
      }}
    />
  );
}
