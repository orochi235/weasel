import type { ReactNode } from 'react';
import { Focusable } from 'react-aria-components';
import { Tooltip, TooltipTrigger } from '../Tooltip';
import s from './SidebarPanel.module.css';

/** Props for {@link SidebarPanel}. */
export interface SidebarPanelProps {
  /** Title rendered in the panel's header row. */
  title?: ReactNode;
  /**
   * Collapsed state — when true, only the header paints; the body is
   * omitted. Caller owns the state (typically via prefs) and flips it
   * back via `onToggleCollapse`.
   */
  collapsed?: boolean;
  /**
   * Click handler for the title row. When provided, the header renders
   * as a button (chevron + label) and acts as the collapse toggle.
   * When omitted, the title is static text and the panel can't collapse.
   */
  onToggleCollapse?(): void;
  /**
   * Optional close handler — when provided, the header gains a `×`
   * button on the trailing edge. Caller flips its "hidden" state and
   * conditionally unmounts the panel from the parent.
   */
  onHide?(): void;
  children?: ReactNode;
  className?: string;
}

/**
 * Generic collapsible panel section for sidebars. Pure presentation —
 * caller manages `collapsed`/`hidden` state externally (the pattern is
 * to drive it from app prefs so the Preferences modal and inline
 * chevrons toggle the same map).
 *
 * Pair with `<Sidebar>` for the docked column layout.
 */
export function SidebarPanel(props: SidebarPanelProps) {
  const { title, collapsed, onToggleCollapse, onHide, children, className } = props;
  const cls = [s.panel, collapsed && s.collapsed, className].filter(Boolean).join(' ');
  const headerInteractive = onToggleCollapse !== undefined;
  return (
    <div className={cls}>
      {title !== undefined && (
        <div className={s.titleRow}>
          {headerInteractive ? (
            <button
              type="button"
              className={s.titleButton}
              onClick={onToggleCollapse}
              aria-expanded={!collapsed}
            >
              <span className={[s.chevron, collapsed && s.chevronCollapsed].filter(Boolean).join(' ')} aria-hidden="true">▾</span>
              <span className={s.title}>{title}</span>
            </button>
          ) : (
            <span className={s.title}>{title}</span>
          )}
          {onHide !== undefined && (
            <TooltipTrigger>
              <Focusable>
                <button
                  type="button"
                  className={s.hideButton}
                  onClick={onHide}
                  aria-label="Hide panel"
                >
                  ×
                </button>
              </Focusable>
              <Tooltip>Hide panel</Tooltip>
            </TooltipTrigger>
          )}
        </div>
      )}
      {!collapsed && <div className={s.body}>{children}</div>}
    </div>
  );
}
