import { InfoIcon } from '@weasel-js/ui';
import type { LabChromeContext, LabHeaderItem } from '@weasel-js/labkit';

/** The lab header's Info command; ⌘I / Ctrl+I runs it from anywhere but a text field. */
export function infoItem(open: () => void): LabHeaderItem<LabChromeContext> {
  return {
    icon: InfoIcon,
    label: 'Info',
    shortcut: '⌘I',
    keys: { kind: 'key', key: 'i', mods: { mod: true } },
    onActivate: open,
  };
}
