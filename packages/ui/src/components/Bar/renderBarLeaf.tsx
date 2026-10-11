import type { ReactNode } from 'react';
import type { PrefLeaf } from '@weasel-js/prefs';
import { FitLabel, labelForms } from '../FitLabel/FitLabel';
import s from './Bar.module.css';

/** What a leaf is being drawn into: a labeled row of a form or a panel, or a cell of a bar. */
export type LeafSurface = 'row' | 'bar';

/** A leaf to draw in a bar, as either dispatcher hands it over. */
export interface BarLeaf {
  leaf: PrefLeaf;
  /** The leaf's row form, for a kind whose bar form is the same control. */
  row: () => ReactNode;
}

/**
 * A leaf's bar form: the one place a kind's control in a bar is decided, for
 * a bar in a form and a bar over a selection alike.
 */
export function renderBarLeaf({ leaf, row }: BarLeaf): ReactNode {
  return withBarLabel(leaf, row());
}

/**
 * A control with the words a bar sets before it, for one a renderer other
 * than {@link renderBarLeaf} drew. Null where the control is nothing.
 */
export function withBarLabel(leaf: PrefLeaf, control: ReactNode): ReactNode {
  if (control == null) return null;
  if (!needsLabel(leaf)) return control;
  return (
    <>
      <span className={s.label} data-bar-label="" aria-hidden="true">
        <FitLabel forms={labelForms(leaf.name, leaf.short)} />
      </span>
      {control}
    </>
  );
}

/**
 * Whether a control needs telling from its neighbors in words.
 *
 * Only a bare value box does: a number or a string is a box of characters,
 * and two of them side by side are indistinguishable. Everything else shows
 * what it is — a swatch is a color, a font picker names the family, a flag
 * run and a segmented control label their own segments — so a word in front
 * would repeat what the control already says. `name` stays the accessible
 * name either way, so this costs a screen reader nothing.
 */
function needsLabel(leaf: PrefLeaf): boolean {
  return leaf.kind === 'number' || leaf.kind === 'string';
}
