/**
 * One `PrefLeaf` and its aggregated value in, its control out, sized and composed the way a selection surface
 * draws it: the one leaf switch (`renderLeaf`) with the panel's object layout and field sizing. `ToolOptionsBar`
 * renders a tool's options through the same function.
 */
import type { ReactNode } from 'react';
import type { ControlForm } from '../../ActionButton/controlForm';
import { renderLeaf, type LeafParts } from '../../Prefs/renderLeaf';
import { withRowControl } from '../../Prefs/surfaceControls';
import { PropertyControl, type PropertyControlProps } from '../../Properties/PropertyField';
import { ObjectLeaf } from './ObjectLeaf';
import type { LeafContext, LeafRenderer } from './renderContext';
import s from './SelectionPanel.module.css';

export interface RenderBuiltinOptions {
  /** Identifies the current selection, so a control holding per-selection
   *  scratch (the paint kind memory) is remounted rather than carried over. */
  selectionKey?: string;
  /** True for a field of an object leaf, which writes itself into its parent:
   *  "None" on a nested paint removes the field. */
  nested?: boolean;
  surface?: ControlForm;
}

/** A one-control field, sized as a panel sizes it. */
function panelControl(field: PropertyControlProps, name: string, selectionKey: string): ReactNode {
  switch (field.kind) {
    case 'boolean':
      return <PropertyControl {...withRowControl(field, 'panel')} name={name} className={field.control === 'toggle' ? s.flagToggle : undefined} />;
    case 'number':
      return <PropertyControl {...field} name={name} className={field.control === 'slider' ? s.slider : undefined} />;
    case 'enum':
      // A clearable toggle is a set of exclusive flags, and sits beside other flags sized the way they are.
      return <PropertyControl {...field} name={name} className={field.control === 'toggle' ? (field.onClear ? s.flagToggle : s.toggle) : undefined} />;
    case 'paint':
      // Per-kind switch memory is scratch for one selection; carrying it across would recall the previous node's gradient.
      return <PropertyControl {...field} name={name} key={selectionKey} control="inline" />;
    default:
      return <PropertyControl {...field} name={name} />;
  }
}

/** What a panel draws its own way around the one leaf switch. */
export function panelParts(renderers: Record<string, LeafRenderer> | undefined, selectionKey: string, nested: boolean): LeafParts {
  return {
    surface: 'panel',
    renderers,
    nested,
    object: (ctx) => <ObjectLeaf ctx={ctx} renderers={renderers} selectionKey={selectionKey} />,
    control: (field, _ctx, name) => panelControl(field, name, selectionKey),
  };
}

export function renderBuiltin(
  ctx: LeafContext,
  ariaLabel: string,
  renderers?: Record<string, LeafRenderer>,
  { selectionKey = '', nested = false, surface = 'row' }: RenderBuiltinOptions = {},
): ReactNode {
  return renderLeaf(ctx, panelParts(renderers, selectionKey, nested), ariaLabel, surface);
}
