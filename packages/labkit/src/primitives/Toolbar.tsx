import type { MouseEventHandler, ReactNode } from 'react';
import { useRovingTabIndex } from './useRovingTabIndex';

/** Props for `<Toolbar>`. */
export interface ToolbarProps {
  children: ReactNode;
  /** Names the toolbar for assistive tech. Required by the APG pattern when a
   *  view holds more than one. */
  'aria-label'?: string;
}

/** A horizontal bar of controls. Fill it with `<Toolbar.Title>`,
 *  `<Toolbar.Group>`, `<Toolbar.Button>` and `<Toolbar.Spacer>`. */
export function Toolbar({ children, 'aria-label': ariaLabel }: ToolbarProps) {
  const { ref, onKeyDown } = useRovingTabIndex<HTMLDivElement>();
  return (
    <div
      ref={ref}
      className="lk-toolbar"
      role="toolbar"
      aria-label={ariaLabel}
      onKeyDown={onKeyDown}
    >
      {children}
    </div>
  );
}

interface TitleProps {
  children: ReactNode;
}
function Title({ children }: TitleProps) {
  return <span className="lk-toolbar-title">{children}</span>;
}

/** Props for `<Toolbar.Group>`. */
export interface ToolbarGroupProps {
  children: ReactNode;
  /** Pushes this group, and everything after it, to the far end. */
  end?: boolean;
  'aria-label'?: string;
}

/** Related controls, kept tight and ruled off from their neighbors. Group
 *  rather than separate with repeated `<Toolbar.Spacer>`: consecutive spacers
 *  share the free space, so every gap collapses to the same slack and the bar
 *  reads as one undifferentiated run. */
function Group({ children, end, 'aria-label': ariaLabel }: ToolbarGroupProps) {
  return (
    // biome-ignore lint/a11y/useSemanticElements: a group inside role="toolbar" is the APG pattern; the rule is local and cannot see the parent. <fieldset> means form controls, needs a <legend> to be named, and its UA min-width breaks flex children.
    <div
      className={`lk-toolbar-group${end ? ' lk-toolbar-group--end' : ''}`}
      role="group"
      aria-label={ariaLabel}
    >
      {children}
    </div>
  );
}

/** Props for `<Toolbar.Button>`. */
export interface ToolbarButtonProps {
  children: ReactNode;
  onClick: MouseEventHandler<HTMLButtonElement>;
  disabled?: boolean;
  title?: string;
  /** Required when `children` is an icon with no text of its own. */
  'aria-label'?: string;
  /** `danger` reddens on hover — for actions that discard work. */
  variant?: 'default' | 'danger';
  /** Square, for a button whose whole content is one glyph. */
  iconOnly?: boolean;
  /** Makes this a toggle: `aria-pressed`, and held down while true. */
  pressed?: boolean;
}

function Button({
  children,
  onClick,
  disabled,
  title,
  'aria-label': ariaLabel,
  variant = 'default',
  iconOnly,
  pressed,
}: ToolbarButtonProps) {
  const cls = [
    'lk-toolbar-button',
    variant === 'danger' && 'lk-toolbar-button--danger',
    iconOnly && 'lk-toolbar-button--icon',
    pressed && 'lk-toolbar-button--pressed',
  ]
    .filter(Boolean)
    .join(' ');
  return (
    <button
      type="button"
      className={cls}
      onClick={onClick}
      disabled={disabled}
      title={title}
      aria-label={ariaLabel ?? title}
      aria-pressed={pressed}
    >
      {children}
    </button>
  );
}

function Spacer() {
  return <span className="lk-toolbar-spacer" aria-hidden="true" />;
}

/** A label within a toolbar. */
Toolbar.Title = Title;
/** A ruled-off run of related controls. */
Toolbar.Group = Group;
/** A button within a toolbar. */
Toolbar.Button = Button;
/** Flexible space that pushes what follows to the far end of the toolbar. */
Toolbar.Spacer = Spacer;
