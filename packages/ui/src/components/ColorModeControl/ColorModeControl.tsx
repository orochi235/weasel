import type { ReactElement } from 'react';
import type { ColorModePreference } from '@weasel-js/theme';
import { ToggleBar, type ToggleBarItem, type ToggleBarVariant } from '../ToggleBar/ToggleBar';
import { useDensity, type ControlSize } from '../Density';
import { COLOR_MODES } from '../colorModes';
import { Icon } from '../../icons/Icon';

/** Props for {@link ColorModeControl}. */
export interface ColorModeControlProps {
  value: ColorModePreference;
  onChange: (next: ColorModePreference) => void;
  /** Accessible name of the group. Defaults to `'Color mode'`. */
  'aria-label'?: string;
  /** Default: the nearest `Density` scope's, else `md`. */
  size?: ControlSize;
  variant?: ToggleBarVariant;
  className?: string;
}

function items(glyph: number): ToggleBarItem<ColorModePreference>[] {
  return COLOR_MODES.map((m) => ({
    value: m.value,
    label: <Icon name={m.glyph} size={glyph} />,
    ariaLabel: m.label,
    tooltip: m.hint ? `${m.label} — ${m.hint}` : m.label,
  }));
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
  'aria-label': ariaLabel = 'Color mode',
  size,
  variant,
  className,
}: ColorModeControlProps): ReactElement {
  const resolved = useDensity(size);
  return (
    <ToggleBar
      items={ITEMS[resolved]}
      value={value}
      onChange={(next) => {
        if (next) onChange(next);
      }}
      aria-label={ariaLabel}
      size={resolved}
      variant={variant}
      className={className}
    />
  );
}
