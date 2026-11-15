import { forwardRef, type ButtonHTMLAttributes, type DragEvent, type MouseEvent, type PointerEvent, type ReactNode, type Ref, type RefObject } from 'react';
import { assignRef } from '@weasel-js/react';
import type { Grade } from '@weasel-js/theme';
import { ButtonTooltip, type TooltipFields } from '../Tooltip/buttonTooltip';
import { useDisabled, type DisableableProps } from '../Disabled';
import { useAppearance } from '../appearance';
import { useControlForm, type ControlForm } from './controlForm';
import { usePreviewWhileNear } from './usePreviewWhileNear';
import { composeHandler, type DataAttributes } from '../../nativeProps';
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

/** The `<button>` attributes an {@link ActionButton} writes itself: its name from `label`, its state from `active`,
 *  its hold from `disabled` and `missing`. It is never a form's submitter, and `form` is where it is drawn. A `popup`
 *  writes `aria-haspopup` and `aria-expanded` over passed ones. */
export type ActionButtonOwnedAttribute =
  | 'aria-label' | 'aria-pressed' | 'aria-current' | 'aria-disabled'
  | 'disabled' | 'type' | 'form' | 'children' | 'draggable';

/** Props for {@link ActionButton}. `tooltip` replaces the tooltip outright. Every native `<button>` attribute and
 *  handler it does not write itself passes through. */
export type ActionButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, ActionButtonOwnedAttribute>
  & DataAttributes & DisableableProps & TooltipFields & {
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
  /** The press, after `onClick`; an `onClick` that calls `preventDefault()` skips it. */
  onPress(e: MouseEvent<HTMLButtonElement>): void;
  /** Show what pressing would do, while the button is hovered or focused; returns what takes it down. */
  preview?: () => () => void;
  /** Makes the button a drag source, starting a drag with this. */
  onDragStart?(e: DragEvent<HTMLButtonElement>): void;
};

/**
 * One action's button, drawn in the form of where it sits (see `ControlForm`): a bar's cell, its icon with the label
 * and shortcut in a tooltip; a menu row of icon, label, and shortcut; a form's or a popover's row of icon and label;
 * or a palette's tool, its label and shortcut under its icon.
 *
 * A caller's handler runs before the button's own (the preview's show and hide, a menu popup's press), and one that
 * calls `preventDefault()` skips it. `ref` forwards to the `<button>`.
 */
export const ActionButton = forwardRef(function ActionButton(props: ActionButtonProps, ref: Ref<HTMLButtonElement>) {
  const {
    label, icon, children, description, grade, active, popup, missing, onPress, preview, shortcut, tooltip, className,
    labeled, form: ownForm, disabled: _disabled, disabledReason: _disabledReason,
    onClick, onPointerDown, onPointerEnter, onPointerLeave, onFocus, onBlur, ...native
  } = props;
  const form = useControlForm(ownForm);
  const dead = missing !== undefined;
  const { disabled, reason } = useDisabled(props);
  const { show, hide } = usePreviewWhileNear(disabled || dead ? undefined : preview);
  const appearance = useAppearance({ grade });
  const tip = dead ? { tooltip: `${label}: no action “${missing}”` } : { tooltip, description: description || label, shortcut };
  const palette = form === 'palette';
  const words = palette || form === 'menu' || icon == null || (labeled ?? (form === 'row' || form === 'popover'));
  const cls = palette ? [s.tool, className]
    : [s.action, form === 'bar' && s.cell, words && s.labeled, words && (form === 'row' || form === 'popover') && s.row, form === 'menu' && s.menu, className];
  const shown = children ?? label;
  const menu = popup?.type === 'menu' ? popup : undefined;
  return (
    // A dead or explained button keeps its tooltip, which is the only thing that says why.
    <ButtonTooltip tip={tip} disabled={disabled && !dead} disabledReason={reason}>
      <button
        {...native}
        ref={(el) => {
          assignRef(ref, el);
          assignRef(menu?.ref, el);
        }}
        id={menu?.id ?? native.id}
        type="button"
        data-form={form}
        aria-label={label}
        aria-disabled={disabled || dead || undefined}
        disabled={disabled && !dead && reason === undefined}
        {...(palette ? { 'aria-current': active ? 'true' : undefined } : { 'aria-pressed': active })}
        {...appearance}
        {...(popup ? { 'aria-haspopup': popup.type, 'aria-expanded': popup.expanded } : {})}
        className={cls.filter(Boolean).join(' ')}
        {...(dead ? { 'data-missing': missing } : {})}
        onClick={composeHandler(onClick, (e) => {
          hide();
          if (!disabled && !dead) onPress(e);
        })}
        onPointerDown={composeHandler(onPointerDown, menu?.onPointerDown)}
        draggable={props.onDragStart ? true : undefined}
        onPointerEnter={composeHandler(onPointerEnter, show)}
        onPointerLeave={composeHandler(onPointerLeave, hide)}
        onFocus={composeHandler(onFocus, show)}
        onBlur={composeHandler(onBlur, hide)}
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
});
