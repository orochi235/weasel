import type { MouseEventHandler, ReactNode } from 'react';
import { Button } from '../Button';

/** Props for {@link ToolbarButton}. */
export interface ToolbarButtonProps {
  children: ReactNode;
  onClick: MouseEventHandler<HTMLButtonElement>;
  disabled?: boolean;
  /** Tooltip text, and the accessible name when `aria-label` is unset. */
  title?: string;
  /** A key chord, shown after the name in the tooltip. */
  shortcut?: string;
  /** Required when `children` is an icon with no text of its own. */
  'aria-label'?: string;
  /** `danger` reddens on hover — for actions that discard work. */
  grade?: 'danger';
  /** Square, for a button whose whole content is one glyph. */
  iconOnly?: boolean;
  /** A glyph ahead of a text label. */
  icon?: ReactNode;
  /** Makes this a toggle: `aria-pressed`, and held down while true. */
  pressed?: boolean;
}

/** A ghost button at the toolbar's height, named by its `title` when it has no `aria-label`. */
export function ToolbarButton({ children, onClick, disabled, title, shortcut, 'aria-label': ariaLabel, grade, iconOnly, icon, pressed }: ToolbarButtonProps) {
  const name = ariaLabel ?? title;
  const common = { variant: 'ghost', onClick, disabled, grade, pressed, shortcut, tooltip: shortcut ? undefined : title } as const;
  return iconOnly ? (
    <Button {...common} iconOnly ariaLabel={name ?? ''}>
      {children}
    </Button>
  ) : (
    <Button {...common} ariaLabel={name} leadingIcon={icon}>
      {children}
    </Button>
  );
}
