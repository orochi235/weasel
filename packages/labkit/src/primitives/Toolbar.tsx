import type { MouseEventHandler, ReactNode } from 'react';

export interface ToolbarProps {
  children: ReactNode;
}

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

Toolbar.Title = Title;
Toolbar.Button = Button;
Toolbar.Spacer = Spacer;
