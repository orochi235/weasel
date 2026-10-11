import type { PrefAction } from '@weasel-js/prefs';
import { Button } from '../Button';
import { useLeafAction } from './useLeafAction';

/** An `action` leaf's button in a row: its label, or its icon alone for `control: 'icon'`. */
export function PrefActionButton({ pref, path, disabled: off }: { pref: PrefAction; path: string; disabled?: boolean }) {
  const { press, label, icon, shortcut, disabled, active, missing } = useLeafAction(pref, path, off);
  const button = {
    size: 'sm',
    disabled: disabled || missing !== undefined,
    pressed: active,
    shortcut,
    onClick: press,
  } as const;
  if (pref.control === 'icon' && icon != null) {
    return (
      <Button {...button} iconOnly ariaLabel={label}>
        {icon}
      </Button>
    );
  }
  return <Button {...button}>{label}</Button>;
}
