import type { CSSProperties, ReactNode } from 'react';
import s from './Sidebar.module.css';

export interface SidebarProps {
  /**
   * Edge the sidebar docks to. Adds a class hook (`s.left` / `s.right`)
   * so consumers can target either edge for borders, shadows, etc.
   * Purely cosmetic — layout is the parent's job.
   */
  side?: 'left' | 'right';
  /**
   * Accessible label — rendered onto the `<aside>`. Without it, screen
   * readers fall back to "complementary landmark," which is fine for
   * apps with a single sidebar but ambiguous when there's both a left
   * and a right.
   */
  ariaLabel?: string;
  children?: ReactNode;
  className?: string;
  /** Inline style — useful for width-as-custom-property handles or any
   *  other one-off CSS property the consumer wants to set dynamically. */
  style?: CSSProperties;
}

/**
 * Generic sidebar shell — `<aside>` with column layout and token-driven
 * surface treatment. Width, sticky positioning, and resize handles stay
 * the consumer's concern (every app has its own layout grid); the kit
 * just provides the chrome.
 *
 * Pair with `<SidebarPanel>` for collapsible sections.
 */
export function Sidebar(props: SidebarProps) {
  const { side, ariaLabel, children, className, style } = props;
  const cls = [s.sidebar, side === 'left' && s.left, side === 'right' && s.right, className]
    .filter(Boolean).join(' ');
  return (
    <aside className={cls} aria-label={ariaLabel} style={style}>
      {children}
    </aside>
  );
}
