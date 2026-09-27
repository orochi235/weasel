import type { ReactElement, ReactNode } from 'react';
import type { ColorModePreference } from '@weasel-js/theme';
import { ModeAutoIcon, ModeDarkIcon, ModeLightIcon } from '../../icons';
import { Button, type ButtonSize, type ButtonVariant } from '../Button/Button';

/** One stop in a {@link ThemeSwitcher}'s rotation. */
export interface ThemeSwitcherOption<T extends string = string> {
  value: T;
  /** Drawn in the button while this option is current. */
  icon: ReactNode;
  /** The option's name, read in the accessible name and tooltip. */
  label: string;
}

/** The color modes, in rotation order, as {@link ThemeSwitcher} cycles them by default. */
export const COLOR_MODE_OPTIONS: readonly ThemeSwitcherOption<ColorModePreference>[] = [
  { value: 'auto', icon: <ModeAutoIcon size={16} />, label: 'Auto' },
  { value: 'light', icon: <ModeLightIcon size={16} />, label: 'Light' },
  { value: 'dark', icon: <ModeDarkIcon size={16} />, label: 'Dark' },
];

/** Props for {@link ThemeSwitcher}. */
export interface ThemeSwitcherProps<T extends string = ColorModePreference> {
  value: T;
  onChange: (next: T) => void;
  /** The rotation, in order. Defaults to {@link COLOR_MODE_OPTIONS}. */
  options?: readonly ThemeSwitcherOption<T>[];
  /** What is being switched, leading the accessible name and tooltip
   *  (`Theme: Auto — click for Light`). Defaults to `'Theme'`. */
  ariaLabel?: string;
  /** Defaults to `sm`, the size of a header's icon buttons. */
  size?: ButtonSize;
  /** Defaults to `ghost`. */
  variant?: ButtonVariant;
  className?: string;
}

/**
 * One icon button that steps through a list of options: a click moves to the
 * next, a shift-click to the previous, both wrapping. It shows the current
 * option's icon, and its name and tooltip say what is current and what a
 * click chooses. The compact alternative to `ColorModeControl`'s three
 * segments. Controlled: pair the default color modes with
 * `useColorModePreference` from `@weasel-js/theme/react`.
 */
export function ThemeSwitcher<T extends string = ColorModePreference>({
  value,
  onChange,
  options = COLOR_MODE_OPTIONS as unknown as readonly ThemeSwitcherOption<T>[],
  ariaLabel = 'Theme',
  size = 'sm',
  variant = 'ghost',
  className,
}: ThemeSwitcherProps<T>): ReactElement {
  const count = options.length;
  const index = Math.max(0, options.findIndex((o) => o.value === value));
  const current = options[index];
  const next = options[(index + 1) % count];
  const previous = options[(index - 1 + count) % count];
  const name = `${ariaLabel}: ${current.label} — click for ${next.label}`;

  return (
    <Button
      variant={variant}
      size={size}
      iconOnly
      ariaLabel={name}
      tooltip={name}
      className={className}
      onClick={(event) => onChange((event.shiftKey ? previous : next).value)}
    >
      {current.icon}
    </Button>
  );
}
