import type { DragEvent, MouseEvent, PointerEvent, ReactNode, RefObject } from 'react';
import { SegmentTooltip, segmentTooltipContent } from '../segmentTooltip';
import s from './ToolButton.module.css';

/** Props for {@link ToolButton}. */
export interface ToolButtonProps {
  /** Icon node (typically an SVG component). */
  icon: ReactNode;
  /** Human-readable label shown under the icon. */
  label: string;
  /** Optional shortcut hint (e.g. "V" or "⌘Z"). */
  shortcut?: string;
  /** Selected/active state — toggles the active visual treatment. */
  active?: boolean;
  /** Disabled state — passes through to the underlying button. */
  disabled?: boolean;
  /**
   * When true, sets `aria-disabled="true"` on the button without using the
   * native `disabled` attribute. This keeps the button focusable and reachable
   * by keyboard (roving-tabindex still applies) while marking it as ineligible
   * to screen readers. The caller is responsible for making `onClick` a no-op.
   */
  ariaDisabled?: boolean;
  /** Click handler. */
  onClick(e: MouseEvent): void;
  /** Pointer press handler. A `menu` button's own press handler wins. */
  onPointerDown?(e: PointerEvent<HTMLButtonElement>): void;
  /** Makes the button a drag source, starting a drag with this. */
  onDragStart?(e: DragEvent<HTMLButtonElement>): void;
  /** The button opens a menu: it takes the menu trigger's ref, id and press handler, says
   *  `aria-haspopup="menu"`, and draws a mark in its corner. */
  menu?: {
    ref: RefObject<HTMLButtonElement | null>;
    id: string;
    expanded: boolean;
    onPointerDown(e: PointerEvent): void;
  };
  /**
   * Tooltip content. Defaults to `label` (plus `shortcut` if provided).
   */
  title?: string;
  /** Additional class for the root button. */
  className?: string;
}

/**
 * Generic icon-+-label toolbar button — building block for `ToolPalette`
 * and similar surfaces. Headless about layout direction (parent group
 * supplies flex direction via `ToolGroup`). Theme via `--wzl-*` tokens.
 */
export function ToolButton(props: ToolButtonProps) {
  const {
    icon, label, shortcut, active, disabled, ariaDisabled,
    onClick, onPointerDown, onDragStart, title, className, menu,
  } = props;
  const content = segmentTooltipContent({ tooltip: title, shortcut, label }) ?? label;
  const cls = [s.button, active && s.active, className].filter(Boolean).join(' ');
  return (
    <SegmentTooltip content={content} disabled={disabled}>
      <button
        ref={menu?.ref}
        id={menu?.id}
        type="button"
        className={cls}
        aria-haspopup={menu ? 'menu' : undefined}
        aria-expanded={menu ? menu.expanded : undefined}
        onPointerDown={menu?.onPointerDown ?? onPointerDown}
        aria-current={active ? 'true' : undefined}
        aria-disabled={ariaDisabled ? 'true' : undefined}
        disabled={disabled}
        onClick={onClick}
        draggable={onDragStart ? true : undefined}
        onDragStart={onDragStart}
      >
        <span className={s.icon} aria-hidden="true">{icon}</span>
        <span className={s.label}>{label}</span>
        {shortcut && <span className={s.shortcut} aria-hidden="true">{shortcut}</span>}
        {menu && <span className={s.menuMark} aria-hidden="true" />}
      </button>
    </SegmentTooltip>
  );
}
