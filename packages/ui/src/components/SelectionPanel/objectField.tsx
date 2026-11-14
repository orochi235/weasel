/**
 * One field of an object leaf as an unrendered cell: the context its control
 * reads and writes through, and the control drawn for a row or for a bar.
 */
import type { ReactNode } from 'react';
import type { PrefLeaf } from '@weasel-js/prefs';
import { withBarLabel } from '../Bar/renderBarLeaf';
import { drawsBarForm, type ControlForm } from '../ActionButton/controlForm';
import { resolveIcon } from '../Icon/resolveIcon';
import { objectFieldContext } from '../Prefs/objectFieldContext';
import { nodeLeafValue } from './model';
import type { LeafCell } from './cells';
import type { LeafContext, LeafRenderer } from './renderContext';
import { renderBuiltin } from './renderLeaf';
import s from './SelectionPanel.module.css';

/** The object leaf a field belongs to, as its fields read it. */
export interface ObjectFieldOwner {
  /** The object leaf's own context. */
  ctx: LeafContext;
  /** The paired row of each field that shares one, by the field's full path. */
  pairs: ReadonlyMap<string, { key: string; label: string }>;
  renderers?: Record<string, LeafRenderer>;
  selectionKey: string;
}

/** The control of one field: its bar form, or its row form with the glyph that names it where no label does. */
function renderField(
  { renderers, selectionKey, pairs }: Pick<ObjectFieldOwner, 'renderers' | 'selectionKey' | 'pairs'>,
  child: PrefLeaf,
  childCtx: LeafContext,
  surface: ControlForm,
): ReactNode {
  const custom = renderers?.[childCtx.path] ?? renderers?.[child.kind];
  if (drawsBarForm(surface)) {
    return custom
      ? withBarLabel(child, custom(childCtx))
      : renderBuiltin(childCtx, child.name, renderers, { selectionKey, nested: true, surface });
  }
  const rendered = custom
    ? custom(childCtx)
    : renderBuiltin(childCtx, child.name, renderers, { selectionKey, nested: true });
  if (rendered == null) return null;
  // Neither a paired row nor a block one gives a field its own label
  // column, so the glyph is all that names it on screen. The control
  // already carries `name` as its accessible name, which leaves the
  // glyph decorative.
  const unlabeled = pairs.has(childCtx.path) || child.block === true;
  const glyph = unlabeled ? resolveIcon(child.icon) : undefined;
  if (!glyph) return rendered;
  return (
    <span className={s.namedField}>
      {glyph}
      {rendered}
    </span>
  );
}

/** One field as an unrendered cell: its row form, or its bar form in a section drawn as a bar. */
export function objectFieldCell(owner: ObjectFieldOwner, key: string, child: PrefLeaf, surface: ControlForm): LeafCell {
  const childCtx = objectFieldContext(owner.ctx, key, child, nodeLeafValue);
  const pair = owner.pairs.get(childCtx.path);
  return {
    key: childCtx.path,
    leaf: child,
    ctx: childCtx,
    ariaLabel: child.name,
    ...(pair ? { pair } : {}),
    render: () => renderField(owner, child, childCtx, surface),
  };
}
