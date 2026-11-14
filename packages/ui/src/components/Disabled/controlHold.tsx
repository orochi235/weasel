import type { ReactElement, ReactNode } from 'react';
import type { ControlAccess } from '@weasel-js/ui-logic';
import { holdScope, ReasonTold, useControlAccess, type HoldProps } from './Disabled';
import { describedBy, useHoldReason } from './HoldReason';

/** What a focus target a held control draws takes: a thumb, a row, a key mark. */
export interface FocusHoldAttrs {
  'aria-disabled'?: true;
  'aria-readonly'?: true;
  'aria-describedby'?: string;
}

/** What a held control's own button takes: disabled with no reason, else marked and left reachable. */
export interface ButtonHoldAttrs {
  disabled?: true;
  'aria-disabled'?: true;
  'data-disabled'?: '';
}

/** What {@link useControlHold} gives a control that draws its own focus targets. */
export interface ControlHold {
  access: ControlAccess;
  /** Disabled or read-only: every change is refused. */
  refuses: boolean;
  /** Disabled: presses that only choose or look are refused as well. */
  disabled: boolean;
  /** On the root, for the stylesheet. */
  held: 'disabled' | 'readOnly' | undefined;
  /** Spread onto each focus target. `aria-readonly` is left off where the role does not take it. */
  focus: FocusHoldAttrs;
  /** Spread onto a button of the control's own. `changes` says it makes a change, which read-only refuses too. */
  button(changes: boolean): ButtonHoldAttrs;
  /** Follows the root with its reason's description and tooltip. */
  wrap(node: ReactNode): ReactElement;
  /** Holds the kit controls inside the control as it is held, by its own props as well as its scopes, without their
   *  repeating the reason the root tells. */
  scope(node: ReactNode): ReactElement;
}

const NO_BUTTON: ButtonHoldAttrs = {};

/**
 * A control's hold, from its own props and the scopes around it, for a control whose focus targets the kit draws
 * itself: a list's rows, a slider's thumbs, a timeline's keys. What each hold refuses is the control's to say.
 */
export function useControlHold(own: HoldProps, { readonlyRole = true }: { readonlyRole?: boolean } = {}): ControlHold {
  const access = useControlAccess(own);
  const reason = useHoldReason(access.reason);
  const refuses = access.state !== 'enabled';
  const disabled = access.state === 'disabled';
  const focus: FocusHoldAttrs = {
    ...(disabled ? { 'aria-disabled': true } : {}),
    ...(access.state === 'readOnly' && readonlyRole ? { 'aria-readonly': true } : {}),
  };
  const describe = describedBy(reason.describedBy);
  if (describe) focus['aria-describedby'] = describe;
  const marked: ButtonHoldAttrs = access.reachable ? { 'aria-disabled': true, 'data-disabled': '' } : { disabled: true };
  return {
    access,
    refuses,
    disabled,
    held: refuses ? (access.state as 'disabled' | 'readOnly') : undefined,
    focus,
    button: (changes) => ((changes ? refuses : disabled) ? marked : NO_BUTTON),
    wrap: reason.wrap,
    scope: (node) => holdScope(own, <ReasonTold reason={access.reason}>{node}</ReasonTold>),
  };
}
