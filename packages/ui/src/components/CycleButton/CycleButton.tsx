import { forwardRef, type ReactElement, type ReactNode, type Ref } from 'react';
import type { ColorModePreference } from '@weasel-js/theme';
import { Button, type ButtonBase, type ButtonVariant } from '../Button/Button';
import { composeHandler } from '../../nativeProps';
import { useControlSize, type ControlSize } from '../ControlSize';
import { COLOR_MODES } from '../ColorModeControl/colorModes';
import { Icon } from '../Icon/Icon';

/** One stop in a {@link CycleButton}'s rotation. */
export interface CycleButtonOption<T extends string = string> {
  value: T;
  /** Drawn in the button while this option is current. */
  icon: ReactNode;
  /** The option's name, read in the accessible name and tooltip. */
  label: string;
}

/** The color modes, in rotation order: `options` for a {@link CycleButton} that switches the color mode. */
export const COLOR_MODE_OPTIONS: readonly CycleButtonOption<ColorModePreference>[] = COLOR_MODES.map((m) => ({
  value: m.value,
  icon: <Icon name={m.glyph} size={16} />,
  label: m.label,
}));

/** Props for {@link CycleButton}: a {@link Button}'s, but for what the rotation decides (the face, the name, the
 *  tooltip, and `value`), and every native `<button>` attribute and handler among them. */
export type CycleButtonProps<T extends string = string> = Omit<
  ButtonBase, 'value' | 'onChange' | 'children' | 'leadingIcon' | 'trailingIcon' | 'tooltip' | 'shortcut' | 'size' | 'variant'
> & {
  value: T;
  onChange: (next: T) => void;
  /** The rotation, in order. */
  options: readonly CycleButtonOption<T>[];
  /** What is being switched, leading the accessible name and tooltip
   *  (`Theme: Auto — click for Light`). */
  'aria-label': string;
  /** Default: the nearest `ControlSizeScope`'s, else `sm`, the size of a header's icon buttons. */
  size?: ControlSize;
  /** Defaults to `ghost`. */
  variant?: ButtonVariant;
};

function CycleButtonInner<T extends string = string>(
  { value, onChange, options, 'aria-label': ariaLabel, size, variant = 'ghost', onClick, ...rest }: CycleButtonProps<T>,
  ref: Ref<HTMLButtonElement>,
): ReactElement {
  const resolved = useControlSize(size, 'sm');
  const count = options.length;
  const index = Math.max(0, options.findIndex((o) => o.value === value));
  const current = options[index];
  const next = options[(index + 1) % count];
  const previous = options[(index - 1 + count) % count];
  const name = `${ariaLabel}: ${current.label} — click for ${next.label}`;

  return (
    <Button
      {...rest}
      ref={ref}
      variant={variant}
      size={resolved}
      iconOnly
      aria-label={name}
      tooltip={name}
      onClick={composeHandler(onClick, (event) => onChange((event.shiftKey ? previous : next).value))}
    >
      {current.icon}
    </Button>
  );
}

/**
 * One icon button that steps through a list of options: a click moves to the
 * next, a shift-click to the previous, both wrapping. It shows the current
 * option's icon, and its name and tooltip say what is current and what a
 * click chooses. With {@link COLOR_MODE_OPTIONS} it is the compact alternative
 * to `ColorModeControl`'s three segments; pair it with `useColorModePreference`
 * from `@weasel-js/theme/react`. Controlled.
 *
 * A caller's `onClick` runs first, and one that calls `preventDefault()` keeps the value where it is. `ref`
 * forwards to the `<button>`.
 */
export const CycleButton = forwardRef(CycleButtonInner) as <T extends string = string>(
  props: CycleButtonProps<T> & { ref?: Ref<HTMLButtonElement> },
) => ReactElement;
