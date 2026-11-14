/**
 * A restriction a control is under, such as disabled or read-only, set on the control itself or on a scope around
 * it, with the reason a person is told.
 */
export interface Hold {
  /** Whether the restriction applies. */
  readonly on: boolean;
  /** Why, from the nearest level that applies it and gives one. */
  readonly reason?: string;
}

/** No restriction. */
export const NO_HOLD: Hold = Object.freeze({ on: false });

/**
 * The hold one level adds inside `outer`: a scope nested in another, or a control in its scopes. Any level that is
 * `on` holds everything inside it, and an inner `on: false` adds nothing, so it cannot lift an outer hold. A
 * level's `reason` counts only while that level is `on`, and the nearest one wins.
 */
export function nestHold(outer: Hold, on: boolean | undefined, reason?: string): Hold {
  if (!on) return outer;
  const nearest = reason || outer.reason;
  if (outer.on && outer.reason === nearest) return outer;
  return nearest ? { on: true, reason: nearest } : { on: true };
}

/** How a control responds, given its disabled and read-only holds. */
export interface ControlAccess {
  /** `disabled` beats `readOnly`. */
  readonly state: 'enabled' | 'disabled' | 'readOnly';
  /** Whether it stays focusable and hoverable. False only for a disabled control with no reason: it leaves the tab
   *  order and shows no tooltip. A disabled one with a reason, and a read-only one, stay reachable and refuse
   *  changes. */
  readonly reachable: boolean;
  /** Why it is held, from the hold that decided {@link state}. */
  readonly reason?: string;
}

/** A control's access from its disabled and read-only holds. */
export function controlAccess(disabled: Hold, readOnly: Hold = NO_HOLD): ControlAccess {
  if (disabled.on) return { state: 'disabled', reachable: disabled.reason !== undefined, reason: disabled.reason };
  if (readOnly.on) return { state: 'readOnly', reachable: true, reason: readOnly.reason };
  return ENABLED;
}

const ENABLED: ControlAccess = Object.freeze({ state: 'enabled', reachable: true });
