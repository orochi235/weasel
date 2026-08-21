import type { ReactNode } from 'react';

/** Props for `<Sidebar>`. */
export interface SidebarProps {
  children: ReactNode;
  title?: string;
  collapsed?: boolean;
  onToggle?: () => void;
}

/** A collapsible side panel with an optional title. Collapse state is the
 *  caller's to hold. */
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
