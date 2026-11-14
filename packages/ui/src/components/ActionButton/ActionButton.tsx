import type { DragEvent, MouseEvent, PointerEvent, ReactNode, RefObject } from 'react';
import type { Grade } from '@weasel-js/theme';
import { ButtonTooltip, type TooltipFields } from '../Tooltip/buttonTooltip';
import { useDisabled, type DisableableProps } from '../Disabled';
import { useAppearance } from '../appearance';
import { useControlForm, type ControlForm } from './controlForm';
import { usePreviewWhileNear } from './usePreviewWhileNear';
import s from './ActionButton.module.css';

/** What an {@link ActionButton} opens: a dialog it shows the state of, or a menu whose trigger it is. */
export type ActionButtonPopup =
  | { type: 'dialog'; expanded: boolean }
  | {
    type: 'menu';
    expanded: boolean;
    /** The menu trigger's ref, id, and press handler, which the button takes. */
    ref?: RefObject<HTMLButtonElement | null>;
    id?: string;
    onPointerDown?(e: PointerEvent): void;
  };

/** Props for {@link ActionButton}. `tooltip` replaces the tooltip outright. */
export interface ActionButtonProps extends DisableableProps, TooltipFields {
  /** Its name: the accessible name, the words a labeled form reads, and the tooltip's lead. */
  label: string;
  icon?: ReactNode;
  /** What the face shows in place of `label`'s words, where it shows words. */
  children?: ReactNode;
  /** What the tooltip reads in place of the label, before the shortcut. */
  description?: string;
  /** How serious pressing it is: `'danger'` for a button that destroys something, which shows its grade's color
   *  while pointed at. */
  grade?: Grade;
  /** Read the label beside the icon in a bar cell, or not in a row. A button with no icon reads it regardless; a
   *  menu row and a palette's tool always do. */
  labeled?: boolean;
  /** Where it is drawn. Default: the nearest `FormScope`'s, else `'bar'`. */
  form?: ControlForm;
  /** Held down, or in a palette the current tool. Leave unset for an action with no such state. */
  active?: boolean;
  popup?: ActionButtonPopup;
  /** Nothing answers to this key. The button is dead, and its tooltip says why. */
  missing?: string;
  onPress(e: MouseEvent<HTMLButtonElement>): void;
  /** Show what pressing would do, while the button is hovered or focused; returns what takes it down. */
  preview?: () => () => void;
  /** Pointer press handler. A menu popup's own wins. */
  onPointerDown?(e: PointerEvent<HTMLButtonElement>): void;
  /** Makes the button a drag source, starting a drag with this. */
  onDragStart?(e: DragEvent<HTMLButtonElement>): void;
  className?: string;
  'data-testid'?: string;
}

/**
 * One action's button, drawn in the form of where it sits (see `ControlForm`): a bar's cell, its icon with the label
 * and shortcut in a tooltip; a menu row of icon, label, and shortcut; a form's or a popover's row of icon and label;
 * or a palette's tool, its label and shortcut under its icon.
 */
export function ActionButton(props: ActionButtonProps) {
  const { label, icon, children, description, grade, active, popup, missing, onPress, preview, shortcut, tooltip, className } = props;
  const form = useControlForm(props.form);
  const dead = missing !== undefined;
  const { disabled, reason } = useDisabled(props);
  const { show, hide } = usePreviewWhileNear(disabled || dead ? undefined : preview);
  const appearance = useAppearance({ grade });
  const tip = dead ? { tooltip: `${label}: no action “${missing}”` } : { tooltip, description: description || label, shortcut };
  const palette = form === 'palette';
  const words = palette || form === 'menu' || icon == null || (props.labeled ?? (form === 'row' || form === 'popover'));
  const cls = palette ? [s.tool, className]
    : [s.action, form === 'bar' && s.cell, words && s.labeled, words && (form === 'row' || form === 'popover') && s.row, form === 'menu' && s.menu, className];
  const shown = children ?? label;
  return (
    // A dead or explained button keeps its tooltip, which is the only thing that says why.
    <ButtonTooltip tip={tip} disabled={disabled && !dead} disabledReason={reason}>
      <button
        ref={popup?.type === 'menu' ? popup.ref : undefined}
        id={popup?.type === 'menu' ? popup.id : undefined}
        type="button"
        data-testid={props['data-testid']}
        data-form={form}
        aria-label={label}
        aria-disabled={disabled || dead || undefined}
        disabled={disabled && !dead && reason === undefined}
        {...(palette ? { 'aria-current': active ? 'true' : undefined } : { 'aria-pressed': active })}
        {...appearance}
        {...(popup ? { 'aria-haspopup': popup.type, 'aria-expanded': popup.expanded } : {})}
        className={cls.filter(Boolean).join(' ')}
        {...(dead ? { 'data-missing': missing } : {})}
        onClick={(e) => {
          hide();
          if (!disabled && !dead) onPress(e);
        }}
        onPointerDown={(popup?.type === 'menu' ? popup.onPointerDown : undefined) ?? props.onPointerDown}
        draggable={props.onDragStart ? true : undefined}
        onDragStart={props.onDragStart}
        onPointerEnter={show}
        onPointerLeave={hide}
        onFocus={show}
        onBlur={hide}
      >
        {palette ? (
          <>
            <span className={s.toolIcon} aria-hidden="true">{icon}</span>
            <span className={s.toolLabel}>{shown}</span>
            {shortcut && <span className={s.toolShortcut} aria-hidden="true">{shortcut}</span>}
          </>
        ) : (
          <>
            {icon}
            {words && <span>{shown}</span>}
            {form === 'menu' && shortcut && <span className={s.shortcut}>{shortcut}</span>}
          </>
        )}
        {popup?.type === 'menu' && <span className={s.menuMark} aria-hidden="true" />}
      </button>
    </ButtonTooltip>
  );
}
