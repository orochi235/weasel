import { createContext, useContext, useMemo, type ReactElement, type ReactNode } from 'react';
import { controlAccess, nestHold, NO_HOLD, type ControlAccess, type Hold } from '@weasel-js/ui-logic';

const DisabledContext = createContext<Hold>(NO_HOLD);
const ReadOnlyContext = createContext<Hold>(NO_HOLD);

/**
 * What every kit component that is or holds a control takes. On a container it disables everything inside it, the
 * way `<fieldset disabled>` does: it is sugar for wrapping the content in {@link Disabled}.
 */
export interface DisableableProps {
  /** Disables it, and everything inside it. `false` adds nothing: it cannot re-enable a control inside a disabled
   *  scope. */
  disabled?: boolean;
  /** Why it is disabled. Given, a disabled control stays focusable and hoverable, ignores presses, and its tooltip
   *  and description say why; without one anywhere it is natively disabled. Beats a scope's reason. */
  disabledReason?: string;
}

/**
 * What every kit component that is or holds a value control takes. Read-only keeps a value visible, focusable,
 * selectable, and copyable, and refuses changes. On a container it is sugar for wrapping the content in
 * {@link ReadOnly}.
 */
export interface ReadOnlyProps {
  /** Makes it, and everything inside it, read-only. `false` adds nothing. Disabled wins over it. */
  readOnly?: boolean;
  /** Why it is read-only, read in its tooltip and description. Beats a scope's reason. */
  readOnlyReason?: string;
}

/** {@link DisableableProps} and {@link ReadOnlyProps} together. */
export type HoldProps = DisableableProps & ReadOnlyProps;

/** Props for {@link Disabled}. */
export interface DisabledScopeProps {
  /** Whether the scope disables what is inside it. Default `true`. */
  when?: boolean;
  /** Why, for every control inside that gives no nearer reason. */
  reason?: string;
  children?: ReactNode;
}

/**
 * Disables every kit control inside it. Any enclosing scope that is on disables everything within, and an inner
 * `disabled={false}` adds nothing. The nearest reason wins, and a control's own `disabledReason` beats the scope's.
 */
export function Disabled({ when = true, reason, children }: DisabledScopeProps): ReactElement {
  const outer = useContext(DisabledContext);
  const hold = useMemo(() => nestHold(outer, when, reason), [outer, when, reason]);
  return <DisabledContext.Provider value={hold}>{children}</DisabledContext.Provider>;
}

/** Props for {@link ReadOnly}. */
export type ReadOnlyScopeProps = DisabledScopeProps;

/** Makes every kit value control inside it read-only, by the same rule as {@link Disabled}. */
export function ReadOnly({ when = true, reason, children }: ReadOnlyScopeProps): ReactElement {
  const outer = useContext(ReadOnlyContext);
  const hold = useMemo(() => nestHold(outer, when, reason), [outer, when, reason]);
  return <ReadOnlyContext.Provider value={hold}>{children}</ReadOnlyContext.Provider>;
}

/** Whether a control is disabled, by its own props or a {@link Disabled} scope around it, and why. */
export function useDisabled(own?: DisableableProps): { disabled: boolean; reason: string | undefined } {
  const hold = nestHold(useContext(DisabledContext), own?.disabled, own?.disabledReason);
  return { disabled: hold.on, reason: hold.reason };
}

/** Whether a control is read-only, by its own props or a {@link ReadOnly} scope around it, and why. */
export function useReadOnly(own?: ReadOnlyProps): { readOnly: boolean; reason: string | undefined } {
  const hold = nestHold(useContext(ReadOnlyContext), own?.readOnly, own?.readOnlyReason);
  return { readOnly: hold.on, reason: hold.reason };
}

/** How a control responds, from its own props and the scopes around it: disabled beats read-only. */
export function useControlAccess(own?: HoldProps): ControlAccess {
  const disabled = nestHold(useContext(DisabledContext), own?.disabled, own?.disabledReason);
  const readOnly = nestHold(useContext(ReadOnlyContext), own?.readOnly, own?.readOnlyReason);
  return controlAccess(disabled, readOnly);
}

/** Wraps a container's content in the {@link Disabled} and {@link ReadOnly} scopes its own props ask for. */
export function holdScope(props: HoldProps, children: ReactNode): ReactElement {
  // Both scopes always, so turning one on or off does not remount what is inside.
  return (
    <Disabled when={props.disabled === true} reason={props.disabledReason}>
      <ReadOnly when={props.readOnly === true} reason={props.readOnlyReason}>{children}</ReadOnly>
    </Disabled>
  );
}

const ToldContext = createContext<string | undefined>(undefined);

/** Marks `reason` as already told by what holds the controls inside, such as a property row's help, so a control
 *  held for that same reason does not describe it a second time. */
export function ReasonTold({ reason, children }: { reason: string | undefined; children?: ReactNode }): ReactElement {
  return <ToldContext.Provider value={reason}>{children}</ToldContext.Provider>;
}

/** `reason`, unless something around the control tells it already. */
export function useUntoldReason(reason: string | undefined): string | undefined {
  return useContext(ToldContext) === reason ? undefined : reason;
}
