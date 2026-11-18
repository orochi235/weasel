import type { ComponentProps } from 'react';
import { ActionButton, Icon } from '@weasel-js/ui';
import type { LinkRule } from '@weasel-js/prefs/edit';
import { GROUP_ICON, Palette } from './Palette';
import { icon } from '../icons.gen';

/** Props for {@link StructureTools}: the palette's own, and what each tool beside it does. */
export interface StructureToolsProps extends Omit<ComponentProps<typeof Palette>, 'children'> {
  /** What Add makes beside a pref: a `group` or a `section`. */
  branch: string;
  /** Open the dialog that adds a pref, or the branch; absent, that tool is disabled. */
  onAddPref: (() => void) | null;
  onAddBranch: (() => void) | null;
  /** What the link tool is called. */
  links: Pick<LinkRule, 'label' | 'title'>;
  /** Set down a link of what is selected; absent, the link tool is disabled. */
  onLink: (() => void) | null;
  onRemove: (() => void) | null;
}

/** The structure pane's tools in the editor's bar: the palette, then add, link and remove. */
export function StructureTools({ branch, onAddPref, onAddBranch, links, onLink, onRemove, ...palette }: StructureToolsProps) {
  return (
    <Palette {...palette}>
      <ActionButton icon={<Icon name={icon('core:tune')} mark={icon('ui:markAdd')} />} label="Add pref" disabled={onAddPref === null} onPress={() => onAddPref?.()} />
      <ActionButton icon={<Icon name={GROUP_ICON.section} mark={icon('ui:markAdd')} />} label={`Add ${branch}`} disabled={onAddBranch === null} onPress={() => onAddBranch?.()} />
      <ActionButton icon={<Icon name={icon('ui:link')} mark={icon('ui:markAdd')} />} label={links.label} tooltip={links.title}
        disabled={onLink === null} onPress={() => onLink?.()} />
      <ActionButton icon={<Icon name={icon('core:delete')} />} label="Remove" disabled={onRemove === null} onPress={() => onRemove?.()} />
    </Palette>
  );
}
