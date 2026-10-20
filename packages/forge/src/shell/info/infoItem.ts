import { formatShortcut } from '@weasel-js/ui/components/ToolPalette';
import type { LabChromeContext, LabHeaderItem } from '@weasel-js/labkit';
import { icon } from '../../icons.gen';

const KEYS = { kind: 'key', key: 'i', mods: { mod: true } } as const;

/** The lab header's Info command; ⌘I / Ctrl+I runs it from anywhere but a text field. */
export function infoItem(open: () => void): LabHeaderItem<LabChromeContext> {
  return {
    icon: icon('ui:info'),
    label: 'Info',
    shortcut: formatShortcut({ key: KEYS.key, mod: KEYS.mods.mod }),
    keys: KEYS,
    onActivate: open,
  };
}
