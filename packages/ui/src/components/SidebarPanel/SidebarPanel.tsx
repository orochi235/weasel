import type { ReactNode, Ref } from 'react';
import { type AppearanceProps, useAppearance } from '../appearance';
import { CloseButton } from '../CloseButton';
import { DisclosureMark } from '../Disclosure';
import { useCollapse } from '../Properties/collapse';
import s from './SidebarPanel.module.css';

/** Props for {@link SidebarPanel}. */
export interface SidebarPanelProps extends AppearanceProps {
  /** Title rendered in the panel's header row. */
  title?: ReactNode;
  /**
   * Collapsed state — when true, only the header paints; the body is
   * unmounted, so a heavy body costs nothing while folded. Caller owns the
   * state (typically via prefs) and flips it back via `onToggleCollapse`.
   */
  collapsed?: boolean;
  /**
   * Click handler for the title row. When provided, the header renders
   * as a button (fold mark + label) and acts as the collapse toggle.
   * When omitted, the title is static text and the panel can't collapse.
   */
  onToggleCollapse?(): void;
  /**
   * Optional close handler — when provided, the header gains a close
   * button on the trailing edge. Caller flips its "hidden" state and
   * conditionally unmounts the panel from the parent.
   */
  onHide?(): void;
  /** Controls drawn in the header row at its trailing edge, before the close button. */
  actions?: ReactNode;
  /**
   * Controls for the panel itself rather than its contents — undock, pop out —
   * drawn after `actions` and before the close button.
   */
  trailing?: ReactNode;
  /**
   * Take the height the panel's flex container leaves, and hand it to the
   * body, so a body that scrolls itself gets a bounded box. Folded, the panel
   * is as tall as its header.
   */
  fill?: boolean;
  /** The header row, for a container that measures it or drags by it. */
  headerRef?: Ref<HTMLDivElement>;
  children?: ReactNode;
  className?: string;
  /** Classes added to the header row, the title, and the body. The panel's own
   *  look sits in `:where()`, so a class here outranks it. */
  headerClassName?: string;
  titleClassName?: string;
  bodyClassName?: string;
}

const cx = (...names: (string | false | undefined)[]) => names.filter(Boolean).join(' ');

/**
 * Generic collapsible panel section for sidebars. Pure presentation —
 * caller manages `collapsed`/`hidden` state externally (the pattern is
 * to drive it from app prefs so the Preferences modal and inline
 * fold marks toggle the same map).
 *
 * Pair with `<Sidebar>` for the docked column layout.
 */
export function SidebarPanel(props: SidebarPanelProps) {
  const { title, collapsed = false, onToggleCollapse, onHide, actions, trailing, fill, headerRef, children } = props;
  const fold = useCollapse({ collapsed, onCollapsedChange: onToggleCollapse && (() => onToggleCollapse()) });
  const appearance = useAppearance(props);
  const titleBox = cx(s.titleBox, props.titleClassName);
  return (
    <div
      className={cx(s.panel, collapsed && s.collapsed, props.className)}
      data-fill={fill && !collapsed ? '' : undefined}
      {...appearance}
    >
      {title !== undefined && (
        <div className={cx(s.titleRow, props.headerClassName)} ref={headerRef}>
          {onToggleCollapse !== undefined ? (
            <button
              type="button"
              className={cx(s.titleButton, titleBox)}
              {...fold.control}
              // The body is unmounted while folded, so there is nothing to name.
              aria-controls={collapsed ? undefined : fold.body.id}
            >
              <DisclosureMark open={!collapsed} />
              <span className={s.title}>{title}</span>
            </button>
          ) : (
            <span className={cx(s.title, titleBox)}>{title}</span>
          )}
          {actions !== undefined && <div className={s.actions}>{actions}</div>}
          {trailing !== undefined && <div className={s.trailing}>{trailing}</div>}
          {onHide !== undefined && (
            <CloseButton
              className={s.hideButton}
              ariaLabel="Hide panel"
              tooltip="Hide panel"
              onClick={onHide}
            />
          )}
        </div>
      )}
      {!collapsed && (
        <div id={fold.body.id} className={cx(s.body, props.bodyClassName)}>
          {children}
        </div>
      )}
    </div>
  );
}
