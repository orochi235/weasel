import type { ReactElement, ReactNode } from 'react';
import type { ControlAccess } from '@weasel-js/ui-logic';
import { useControlAccess, type HoldProps } from './Disabled';
import { describedBy, useHoldReason } from './HoldReason';

/** What a held control's focus targets take, beside their tab index. */
export interface HeldAttrs {
  'aria-disabled'?: true;
  'aria-readonly'?: true;
  'aria-describedby'?: string;
}

/** What {@link useControlHold} gives a control the kit draws itself: a palette, an editor, a slider. */
export interface ControlHold {
  access: ControlAccess;
  /** Whether every change is refused: disabled or read-only. */
  refuses: boolean;
  /** On the root, for the stylesheet. */
  held: 'disabled' | 'readOnly' | undefined;
  /** Spread onto each focus target. */
  attrs: HeldAttrs;
  /** A focus target's tab index: `live`, or -1 when held with no reason, which takes the control out of the tab order. */
  tabIndex(live: 0 | -1): 0 | -1;
  /** Whether the control is out of reach: held with no reason. Marks it `inert` where its focus targets are drawn
   *  by something else, such as a curve layer. */
  unreachable: boolean;
  /** Follows the control with its reason's description and tooltip, which open on pointing at or focusing anything
   *  inside it. */
  wrap(node: ReactNode): ReactElement;
  /** `live`, or, held, a handler that does nothing: for every path that changes the value. */
  gate<F extends (...args: never[]) => void>(live: F): F;
  gate<F extends (...args: never[]) => void>(live: F | undefined): F | undefined;
}

const ignore = (): void => {};

/** What a held control's root says for the stylesheet: `data-held`. */
export function heldState(access: ControlAccess): 'disabled' | 'readOnly' | undefined {
  return access.state === 'enabled' ? undefined : access.state;
}

/** Just the hold props of `props`, to hand a control drawn in its place. */
export function ownHold({ disabled, disabledReason, readOnly, readOnlyReason }: HoldProps): HoldProps {
  return { disabled, disabledReason, readOnly, readOnlyReason };
}

/** The hold props that hold a part the way `access` holds its control: for a kit control drawn inside another. */
export function holdPropsOf(access: ControlAccess): HoldProps {
  if (access.state === 'disabled') return { disabled: true, disabledReason: access.reason };
  if (access.state === 'readOnly') return { readOnly: true, readOnlyReason: access.reason };
  return {};
}

/** A control's hold, from its own props and the scopes around it. */
export function useControlHold(own: HoldProps): ControlHold {
  const access = useControlAccess(own);
  const reason = useHoldReason(access.reason);
  const refuses = access.state !== 'enabled';
  const unreachable = refuses && !access.reachable;
  const attrs: HeldAttrs = {
    ...(access.state === 'disabled' ? { 'aria-disabled': true } : {}),
    ...(access.state === 'readOnly' ? { 'aria-readonly': true } : {}),
  };
  const describe = describedBy(reason.describedBy);
  if (describe) attrs['aria-describedby'] = describe;
  return {
    access,
    refuses,
    held: heldState(access),
    attrs,
    tabIndex: (live) => (unreachable ? -1 : live),
    unreachable,
    wrap: reason.wrap,
    gate: (<F>(live: F) => (refuses && live ? (ignore as F) : live)) as ControlHold['gate'],
  };
}
