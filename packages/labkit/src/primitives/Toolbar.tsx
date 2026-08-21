import type { MouseEventHandler, ReactNode } from 'react';

/** Props for `<Toolbar>`. */
export interface ToolbarProps {
  children: ReactNode;
}

/** A horizontal bar of controls. Fill it with `<Toolbar.Title>`,
 *  `<Toolbar.Button>` and `<Toolbar.Spacer>`. */
export function Toolbar({ children }: ToolbarProps) {
  return <div className="lk-toolbar">{children}</div>;
}

interface TitleProps {
  children: ReactNode;
}
function Title({ children }: TitleProps) {
  return <span className="lk-toolbar-title">{children}</span>;
}

interface ButtonProps {
  children: ReactNode;
  onClick: MouseEventHandler<HTMLButtonElement>;
  disabled?: boolean;
  title?: string;
}
function Button({ children, onClick, disabled, title }: ButtonProps) {
  return (
    <button
      type="button"
      className="lk-toolbar-button"
      onClick={onClick}
      disabled={disabled}
      title={title}
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
/** A button within a toolbar. */
Toolbar.Button = Button;
/** Flexible space that pushes what follows to the far end of the toolbar. */
Toolbar.Spacer = Spacer;
