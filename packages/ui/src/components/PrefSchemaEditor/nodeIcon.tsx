import type { ReactNode } from 'react';
import { isPrefLeaf, isPrefSection, type PrefAction } from '@weasel-js/prefs';
import type { IconRef } from '@weasel-js/icons';
import { Icon } from '../../icons';
import { icon } from '../../icons.gen';
import type { EditorAction } from './editorActions';
import { GROUP_ICON } from './Palette';
import type { SchemaNode } from './schemaEdit';
import { slotOf } from './schemaTree';

/** The glyph of an `actions` leaf, which groups the actions it draws as a group does its own rows. */
export const ACTIONS_ICON: IconRef = icon('formActions');

/** The glyph of a leaf whose fields the tree draws under it: an open `object`, or a list or map of them. */
const FIELDS_ICON: IconRef = icon('typeBraces');

/**
 * The glyph a node is drawn with, where it has one: a group's for how it is drawn, unset drawn by its depth (a page
 * at the top, a section below that), an `actions` leaf's, the icon of the action an action pref fires, and the
 * braces of a leaf with fields under it. `null` for a node with none.
 */
export function nodeIcon(node: SchemaNode, top: boolean, actions?: readonly EditorAction[]): ReactNode {
  if (!isPrefLeaf(node)) return <Icon size={16} name={GROUP_ICON[node.as ?? (top && !isPrefSection(node) ? 'page' : 'section')]} />;
  if (node.kind === 'actions') return <Icon size={16} name={ACTIONS_ICON} />;
  if (node.kind === 'action') return actions?.find((a) => a.key === (node as PrefAction).action)?.icon ?? null;
  if (slotOf(node) !== undefined) return <Icon size={16} name={FIELDS_ICON} />;
  return null;
}
