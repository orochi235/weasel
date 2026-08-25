import type { MouseEventHandler, ReactNode } from 'react';

/** Props for `<Toolbar>`. */
export interface ToolbarProps {
  children: ReactNode;
}

/** A horizontal bar of controls. Fill it with `<Toolbar.Title>`,
 *  `<Toolbar.Group>`, `<Toolbar.Button>` and `<Toolbar.Spacer>`. */
export function Toolbar({ children }: ToolbarProps) {
  return <div className="lk-toolbar">{children}</div>;
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
    // biome-ignore lint/a11y/useSemanticElements: <fieldset> means form controls, needs a <legend> to be named, and its UA min-width breaks flex children.
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
}

function Button({
  children,
  onClick,
  disabled,
  title,
  'aria-label': ariaLabel,
  variant = 'default',
  iconOnly,
}: ToolbarButtonProps) {
  const cls = [
    'lk-toolbar-button',
    variant === 'danger' && 'lk-toolbar-button--danger',
    iconOnly && 'lk-toolbar-button--icon',
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
