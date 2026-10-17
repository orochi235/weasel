import type { ReactElement } from 'react';
import type { ColorModePreference } from '@weasel-js/theme';
import { ToggleBar, type ToggleBarItem, type ToggleBarSize, type ToggleBarVariant } from '../ToggleBar/ToggleBar';
import { icon } from '../../icons.gen';
import { Icon } from '../../icons/Icon';

/** Props for {@link ColorModeControl}. */
export interface ColorModeControlProps {
  value: ColorModePreference;
  onChange: (next: ColorModePreference) => void;
  /** Accessible name of the group. Defaults to `'Color mode'`. */
  ariaLabel?: string;
  size?: ToggleBarSize;
  variant?: ToggleBarVariant;
  className?: string;
}

function items(glyph: number): ToggleBarItem<ColorModePreference>[] {
  return [
    { value: 'auto', label: <Icon name={icon('modeAuto')} size={glyph} />, ariaLabel: 'Auto', tooltip: 'Auto — follow the system' },
    { value: 'light', label: <Icon name={icon('modeLight')} size={glyph} />, ariaLabel: 'Light', tooltip: 'Light' },
    { value: 'dark', label: <Icon name={icon('modeDark')} size={glyph} />, ariaLabel: 'Dark', tooltip: 'Dark' },
  ];
}

const ITEMS = { sm: items(12), md: items(14) };

/**
 * The Auto / Light / Dark choice, as a three-way radiogroup of mode glyphs.
 * Controlled: pair it with `useColorModePreference` from
 * `@weasel-js/theme/react` and put the hook's resolved `mode` in the
 * `ThemeProvider` selection.
 */
export function ColorModeControl({
  value,
  onChange,
  ariaLabel = 'Color mode',
  size,
  variant,
  className,
}: ColorModeControlProps): ReactElement {
  return (
    <ToggleBar
      items={ITEMS[size ?? 'md']}
      value={value}
      onChange={(next) => {
        if (next) onChange(next);
      }}
      ariaLabel={ariaLabel}
      size={size}
      variant={variant}
      className={className}
    />
  );
}
