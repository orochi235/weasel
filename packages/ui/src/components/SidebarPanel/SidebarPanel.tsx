import type { ReactNode, Ref } from 'react';
import { type AppearanceProps, useAppearance } from '../appearance';
import { Button, CLOSE_BUTTON_PROPS } from '../Button';
import { DisclosureMark } from '../Disclosure';
import { type CollapseProps, useCollapse } from '../Properties/collapse';
import s from './SidebarPanel.module.css';
import { holdScope, type HoldProps } from '../Disabled';

/** Props for {@link SidebarPanel}. */
export interface SidebarPanelProps extends AppearanceProps, Omit<CollapseProps, 'twisty'>, HoldProps {
  /** Title rendered in the panel's header row. */
  title?: ReactNode;
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
 * Generic collapsible panel section for sidebars. It folds as `PropertyGroup`
 * does: `collapsed` and `onCollapsedChange` held by the caller (driven from app
 * prefs, so the Preferences modal and the fold mark toggle the same map), or
 * `defaultCollapsed` held by the panel. Folded, the body is unmounted.
 *
 * Pair with `<Sidebar>` for the docked column layout.
 */
export function SidebarPanel(props: SidebarPanelProps) {
  const { title, onHide, actions, trailing, fill, headerRef, children } = props;
  const fold = useCollapse(props);
  const collapsed = fold.folded;
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
          {fold.folds ? (
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
            <Button {...CLOSE_BUTTON_PROPS}
              className={s.hideButton}
              aria-label="Hide panel"
              tooltip="Hide panel"
              onClick={onHide}
            />
          )}
        </div>
      )}
      {!collapsed && (
        <div id={fold.body.id} className={cx(s.body, props.bodyClassName)}>
          {holdScope(props, children)}
        </div>
      )}
    </div>
  );
}
