import type { MouseEventHandler, ReactNode } from 'react';
import { Button } from '../Button';

interface ToolbarButtonBase {
  children: ReactNode;
  onClick: MouseEventHandler<HTMLButtonElement>;
  disabled?: boolean;
  /** Tooltip text, and the accessible name when `aria-label` is unset. */
  title?: string;
  /** A key chord, shown after the name in the tooltip. */
  shortcut?: string;
  /** The accessible name, where `title` is not the one wanted. */
  'aria-label'?: string;
  /** `danger` reddens on hover — for actions that discard work. */
  grade?: 'danger';
  /** A glyph ahead of a text label. */
  icon?: ReactNode;
  /** Makes this a toggle: `aria-pressed`, and held down while true. */
  pressed?: boolean;
}

/** Props for {@link ToolbarButton}. `iconOnly` makes it square, for a button whose whole content is one glyph; having
 *  no words of its own, it then needs a `title` or an `aria-label` to be named by. */
export type ToolbarButtonProps = ToolbarButtonBase & (
  | { iconOnly?: false }
  | { iconOnly: true; title: string }
  | { iconOnly: true; 'aria-label': string }
);

/** A ghost button at the toolbar's height, named by its `title` when it has no `aria-label`. */
export function ToolbarButton(props: ToolbarButtonProps) {
  const { children, onClick, disabled, title, shortcut, 'aria-label': ariaLabel, grade, iconOnly, icon, pressed } = props;
  const name = ariaLabel ?? title;
  const common = { variant: 'ghost', onClick, disabled, grade, pressed, shortcut, tooltip: shortcut ? undefined : title } as const;
  return iconOnly ? (
    <Button {...common} iconOnly ariaLabel={name!}>
      {children}
    </Button>
  ) : (
    <Button {...common} ariaLabel={name} leadingIcon={icon}>
      {children}
    </Button>
  );
}
