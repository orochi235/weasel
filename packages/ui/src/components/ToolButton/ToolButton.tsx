import type { ReactNode } from 'react';
import { Focusable } from 'react-aria-components';
import { Tooltip, TooltipTrigger } from '../Tooltip';
import s from './ToolButton.module.css';

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
  /**
   * Whether this button is the currently tabbable member of its toolbar.
   * Toolbars use roving tabindex: exactly one button has `tabIndex=0` at
   * a time; the rest are `-1`. Caller manages which.
   */
  tabbable?: boolean;
  /** Click handler. */
  onClick(): void;
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
  const { icon, label, shortcut, active, disabled, ariaDisabled, tabbable, onClick, title, className } = props;
  const resolvedTitle = title ?? (shortcut ? `${label} (${shortcut})` : label);
  const cls = [s.button, active && s.active, className].filter(Boolean).join(' ');
  return (
    <TooltipTrigger isDisabled={disabled}>
      <Focusable isDisabled={disabled}>
        <button
          type="button"
          tabIndex={tabbable ? 0 : -1}
          className={cls}
          aria-current={active ? 'true' : undefined}
          aria-disabled={ariaDisabled ? 'true' : undefined}
          disabled={disabled}
          onClick={onClick}
        >
          <span className={s.icon} aria-hidden="true">{icon}</span>
          <span className={s.label}>{label}</span>
          {shortcut && <span className={s.shortcut}>{shortcut}</span>}
        </button>
      </Focusable>
      <Tooltip>{resolvedTitle}</Tooltip>
    </TooltipTrigger>
  );
}
