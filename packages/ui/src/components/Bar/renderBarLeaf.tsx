import type { ReactNode } from 'react';
import { prefIsCompound, type PrefAction, type PrefLeaf } from '@weasel-js/prefs';
import { namedGlyph } from '../../icons/namedGlyph';
import type { PropertyControlProps } from '../Properties/PropertyField';
import { BarAction } from './BarAction';
import { BarField, BarLabel, barLabels } from './BarField';
import { BarPopover } from './BarPopover';
import s from './Bar.module.css';

/** What a leaf is being drawn into: a labeled row of a form or a panel, or a cell of a bar. */
export type LeafSurface = 'row' | 'bar';

/** A leaf to draw in a bar, as either dispatcher hands it over. */
export interface BarLeaf {
  leaf: PrefLeaf;
  /** The path the leaf sits at, which an action is told. */
  path: string;
  /** The accessible name the leaf's control carries. */
  name: string;
  /** The leaf as one control's props, with the surface's own values and
   *  writers. Null for a leaf that is not one control. */
  field: PropertyControlProps | null;
  /** The leaf takes no input. `field` and `row` carry it already; this reaches an action's button. */
  disabled?: boolean;
  /** The leaf's row form: what a popover holds for a leaf whose value is made
   *  of others, and what a kind with no bar form draws. */
  row: () => ReactNode;
}

/**
 * A leaf's bar form: the one place a kind's control in a bar is decided, for
 * a bar in a form and a bar over a selection alike.
 */
export function renderBarLeaf({ leaf, path, name, field, disabled, row }: BarLeaf): ReactNode {
  if (field !== null) {
    // A flag's icon is already its button's face.
    const icon = field.kind === 'boolean' ? undefined : namedGlyph(leaf.icon);
    return <BarField {...field} name={name} short={leaf.short} icon={icon} />;
  }
  if (leaf.kind === 'action') return <BarAction leaf={leaf as PrefAction} path={path} disabled={disabled} />;
  // An `actions` run needs the registry's group to draw its buttons from, which no bar reads yet.
  if (leaf.kind === 'actions') return null;
  if (leaf.kind === 'label') return <span className={s.words}>{leaf.name}</span>;
  const body = row();
  if (body == null || !prefIsCompound(leaf)) return body;
  return (
    <BarPopover label={leaf.name} icon={namedGlyph(leaf.icon)}>
      {body}
    </BarPopover>
  );
}

/**
 * A control with the words a bar sets before it, for one a renderer other
 * than {@link renderBarLeaf} drew. Null where the control is nothing.
 */
export function withBarLabel(leaf: PrefLeaf, control: ReactNode): ReactNode {
  if (control == null) return null;
  if (!barLabels(leaf.kind)) return control;
  return (
    <>
      <BarLabel name={leaf.name} short={leaf.short} icon={namedGlyph(leaf.icon)} />
      {control}
    </>
  );
}
