import type { ReactNode } from 'react';
import type { ControlAccess } from '@weasel-js/ui-logic';
import { useControlAccess, type HoldProps } from './Disabled';
import { describedBy, useHoldReason } from './HoldReason';

/** The attributes a held native control takes. */
export interface NativeHoldAttrs {
  disabled?: boolean;
  'aria-disabled'?: true;
  'aria-readonly'?: true;
  'data-disabled'?: '';
  'aria-describedby'?: string;
}

/** What {@link useNativeHold} gives a control drawn as a native element. */
export interface NativeHold {
  /** How the control responds. */
  access: ControlAccess;
  /** Spread onto the native element. Disabled with no reason is native `disabled`; held for a reason it stays
   *  focusable, `aria-disabled` and `data-disabled`; read-only is `aria-readonly`. */
  attrs: NativeHoldAttrs;
  /** Whether the control must drop every change: it is disabled or read-only. */
  refuses: boolean;
  /** Wraps the control so it shows its reason in a tooltip. */
  wrap(node: ReactNode): ReactNode;
}

/** A native control's hold, from its own props and the scopes around it. `aria-readonly` is left off for a role
 *  that does not take it; pass `readonlyRole: false` there. */
export function useNativeHold(
  own: HoldProps & { 'aria-describedby'?: string },
  { readonlyRole = true }: { readonlyRole?: boolean } = {},
): NativeHold {
  const access = useControlAccess(own);
  const reason = useHoldReason(access.reason);
  const attrs: NativeHoldAttrs = { 'aria-describedby': describedBy(own['aria-describedby'], reason.describedBy) };
  if (access.state === 'disabled') {
    if (access.reachable) Object.assign(attrs, { 'aria-disabled': true, 'data-disabled': '' });
    else attrs.disabled = true;
  } else if (access.state === 'readOnly' && readonlyRole) attrs['aria-readonly'] = true;
  return { access, attrs, refuses: access.state !== 'enabled', wrap: reason.wrap };
}
