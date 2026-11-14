import type { ReactElement, ReactNode } from 'react';
import type { ControlAccess } from '@weasel-js/ui-logic';
import { useControlAccess, type HoldProps } from './Disabled';
import { describedBy, useHoldReason } from './HoldReason';

/** The React Aria props a control's access becomes. */
export interface RacHoldProps {
  /** React Aria's disabled: out of the tab order. */
  isDisabled?: boolean;
  /** React Aria's read-only: focusable, and refusing changes. */
  isReadOnly?: boolean;
  /** Marks a held control for the stylesheets: `disabled` dims one that stays reachable for its reason. */
  'data-held'?: 'disabled' | 'readOnly';
}

/** Translates a control's access into React Aria's `isDisabled` and `isReadOnly`, once, at the wrapper. Disabled
 *  with no reason is React Aria's disabled; held for a reason, or read-only, it is React Aria's read-only, which
 *  keeps it focusable and refuses changes. */
export function racHold(access: ControlAccess): RacHoldProps {
  if (access.state === 'enabled') return {};
  if (!access.reachable) return { isDisabled: true };
  return { isReadOnly: true, 'data-held': access.state };
}

/** What {@link useRacHold} splits a React Aria wrapper's props into. */
export interface RacHold<P> {
  /** The props with the kit's hold props taken out. */
  rest: Omit<P, keyof HoldProps>;
  /** How the control responds. */
  access: ControlAccess;
  /** Spread onto the React Aria component: its `isDisabled`/`isReadOnly`, and `aria-describedby` with the reason. */
  rac: RacHoldProps & { 'aria-describedby'?: string };
  /** Wraps the control so it shows its reason in a tooltip. */
  wrap(node: ReactNode): ReactElement;
}

/** A React Aria wrapper's hold: reads its own `disabled`/`readOnly` props and the scopes around it. */
export function useRacHold<P extends HoldProps & { 'aria-describedby'?: string }>(props: P): RacHold<P> {
  const { disabled, disabledReason, readOnly, readOnlyReason, ...rest } = props;
  const access = useControlAccess({ disabled, disabledReason, readOnly, readOnlyReason });
  const reason = useHoldReason(access.reason);
  return {
    rest,
    access,
    rac: { ...racHold(access), 'aria-describedby': describedBy(props['aria-describedby'], reason.describedBy) },
    wrap: reason.wrap,
  };
}
