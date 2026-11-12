import type { IconRef } from '@weasel-js/icons';
import { Icon } from '@weasel-js/ui/components/Icon';

/** A release chip's badge, or no leading icon at all for a package the history names but no longer ships. */
export function chipIcon(name: IconRef | undefined) {
  return name ? <Icon name={name} size={16} /> : undefined;
}
