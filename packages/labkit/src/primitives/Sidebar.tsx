import type { ReactNode } from 'react';

export interface SidebarProps {
  children: ReactNode;
  title?: string;
  collapsed?: boolean;
  onToggle?: () => void;
}

export function Sidebar({ children, title, collapsed = false, onToggle }: SidebarProps) {
  const className = `lk-sidebar${collapsed ? ' lk-sidebar--collapsed' : ''}`;
  return (
    <aside className={className}>
      {(title || onToggle) && (
        <div className="lk-sidebar-header">
          {title && <span className="lk-sidebar-title">{title}</span>}
          {onToggle && (
            <button
              type="button"
              className="lk-sidebar-toggle"
              onClick={onToggle}
              aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >
              {collapsed ? '›' : '‹'}
            </button>
          )}
        </div>
      )}
      <div className="lk-sidebar-body">{children}</div>
    </aside>
  );
}
