import type { MouseEvent, PointerEvent, ReactNode, RefObject } from 'react';
import { Focusable } from 'react-aria-components';
import { Tooltip, TooltipTrigger } from '../Tooltip';
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
    onClick, title, className, menu,
  } = props;
  const resolvedTitle = title ?? (shortcut ? `${label} (${shortcut})` : label);
  const cls = [s.button, active && s.active, className].filter(Boolean).join(' ');
  return (
    <TooltipTrigger isDisabled={disabled}>
      <Focusable isDisabled={disabled}>
        <button
          ref={menu?.ref}
          id={menu?.id}
          type="button"
          className={cls}
          aria-haspopup={menu ? 'menu' : undefined}
          aria-expanded={menu ? menu.expanded : undefined}
          onPointerDown={menu?.onPointerDown}
          aria-current={active ? 'true' : undefined}
          aria-disabled={ariaDisabled ? 'true' : undefined}
          disabled={disabled}
          onClick={onClick}
        >
          <span className={s.icon} aria-hidden="true">{icon}</span>
          <span className={s.label}>{label}</span>
          {shortcut && <span className={s.shortcut}>{shortcut}</span>}
          {menu && <span className={s.menuMark} aria-hidden="true" />}
        </button>
      </Focusable>
      <Tooltip>{resolvedTitle}</Tooltip>
    </TooltipTrigger>
  );
}
