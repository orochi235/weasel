import { Button as UiButton } from '@weasel-js/ui/components/Button';
import {
  ToolbarGroup,
  ToolbarSpacer,
  Toolbar as UiToolbar,
} from '@weasel-js/ui/components/Toolbar';
import type { MouseEventHandler, ReactNode } from 'react';

export type { ToolbarGroupProps } from '@weasel-js/ui/components/Toolbar';

/** Props for `<Toolbar>`. */
export interface ToolbarProps {
  children: ReactNode;
  /** Names the toolbar for assistive tech. Required by the APG pattern when a
   *  view holds more than one. */
  'aria-label'?: string;
}

/** A trial's strip of controls: weasel-ui's `Toolbar` at the compact control
 *  height. Fill it with `<Toolbar.Title>`, `<Toolbar.Group>`,
 *  `<Toolbar.Button>` and `<Toolbar.Spacer>`. */
export function Toolbar({ children, 'aria-label': ariaLabel }: ToolbarProps) {
  return (
    <UiToolbar className="lk-toolbar" aria-label={ariaLabel}>
      {children}
    </UiToolbar>
  );
}

function Title({ children }: { children: ReactNode }) {
  return <span className="lk-toolbar-title">{children}</span>;
}

/** Props for `<Toolbar.Button>`. */
export interface ToolbarButtonProps {
  children: ReactNode;
  onClick: MouseEventHandler<HTMLButtonElement>;
  disabled?: boolean;
  /** Tooltip text, and the accessible name when `aria-label` is unset. */
  title?: string;
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

function Button({
  children,
  onClick,
  disabled,
  title,
  'aria-label': ariaLabel,
  grade,
  iconOnly,
  icon,
  pressed,
}: ToolbarButtonProps) {
  const name = ariaLabel ?? title;
  const common = { variant: 'ghost', onClick, disabled, grade, pressed, tooltip: title } as const;
  return iconOnly ? (
    <UiButton {...common} iconOnly ariaLabel={name ?? ''}>
      {children}
    </UiButton>
  ) : (
    <UiButton {...common} ariaLabel={name} leadingIcon={icon}>
      {children}
    </UiButton>
  );
}

/** A label within a toolbar. */
Toolbar.Title = Title;
/** A ruled-off run of related controls. */
Toolbar.Group = ToolbarGroup;
/** A ghost button at the toolbar's height. */
Toolbar.Button = Button;
/** Flexible space that pushes what follows to the far end of the toolbar. */
Toolbar.Spacer = ToolbarSpacer;
