import type { ReactNode } from 'react';
import { isPrefLeaf, isPrefSection, type PrefAction, type PrefKind } from '@weasel-js/prefs';
import type { IconRef } from '@weasel-js/icons';
import { Icon } from '@weasel-js/ui';
import { icon } from '../icons.gen';
import type { EditorAction } from './editorActions';
import { GROUP_ICON } from './Palette';
import type { SchemaNode } from '@weasel-js/prefs/edit';

/** The glyph of an `actions` leaf, which groups the actions it draws as a group does its own rows. */
export const ACTIONS_ICON: IconRef = icon('ui:formActions');

/** Each built-in kind's glyph, for a leaf that names none of its own. */
const KIND_ICON: Record<PrefKind, IconRef> = {
  number: icon('core:measure'),
  boolean: icon('ui:check'),
  string: icon('core:text'),
  enum: icon('ui:chevron'),
  color: icon('core:eyedropper'),
  paint: icon('core:paintSolid'),
  object: icon('ui:typeBraces'),
  list: icon('ui:layoutRows'),
  map: icon('ui:layoutGrid'),
  union: icon('core:union'),
  field: icon('ui:typeClass'),
  action: icon('ui:play'),
  actions: ACTIONS_ICON,
  alias: icon('ui:link'),
  label: icon('ui:formLabel'),
  separator: icon('ui:formSeparator'),
};

/** A custom kind's glyph. */
const CUSTOM_ICON: IconRef = icon('ui:typeGeneric');

/** The glyph a leaf of `kind` is drawn with when it names none of its own. */
export const kindIcon = (kind: string): IconRef => (Object.hasOwn(KIND_ICON, kind) ? KIND_ICON[kind as PrefKind] : CUSTOM_ICON);

/**
 * The glyph a node is drawn with: a group's for how it is drawn, unset drawn by its depth (a page at the top, a
 * section below that); a leaf's own `icon`; the icon of the action an action pref fires; and otherwise its kind's.
 */
export function nodeIcon(node: SchemaNode, top: boolean, actions?: readonly EditorAction[]): ReactNode {
  if (!isPrefLeaf(node)) return <Icon size={16} name={GROUP_ICON[node.as ?? (top && !isPrefSection(node) ? 'page' : 'section')]} />;
  if (node.icon) return <Icon size={16} name={node.icon} />;
  if (node.kind === 'action') {
    const fired = actions?.find((a) => a.key === (node as PrefAction).action)?.icon;
    if (fired) return fired;
  }
  return <Icon size={16} name={kindIcon(node.kind)} />;
}
