import { formatShortcut, InfoIcon } from '@weasel-js/ui';
import type { LabChromeContext, LabHeaderItem } from '@weasel-js/labkit';

const KEYS = { kind: 'key', key: 'i', mods: { mod: true } } as const;

/** The lab header's Info command; ⌘I / Ctrl+I runs it from anywhere but a text field. */
export function infoItem(open: () => void): LabHeaderItem<LabChromeContext> {
  return {
    icon: InfoIcon,
    label: 'Info',
    shortcut: formatShortcut({ key: KEYS.key, mod: KEYS.mods.mod }),
    keys: KEYS,
    onActivate: open,
  };
}
