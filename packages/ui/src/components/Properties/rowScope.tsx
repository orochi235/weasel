import { createContext, type ReactElement, type ReactNode, useContext, useMemo } from 'react';

/** The state a settings row draws, set around it by a {@link RowScope}: whether it is auto, whether its value is
 *  changed or wrong, and how to reset it. Whether it is disabled is the `<Disabled>` scope's, not this one's. */
export interface RowState {
  /** The row is auto: its value is not pinned and the owner computes it. The control keeps drawing, ghosted in
   *  the secondary accent, at the value the owner passes; an edit to it reaches the owner like any other, which
   *  pins. */
  auto?: boolean;
  /** Given, the row's label toggles `auto` when it is clicked. Omitted, the row can show an auto state but not
   *  change it. The label then names that toggle, so the row's control has to carry its own accessible name —
   *  every `<PropertyField>` does. */
  onAutoChange?: (next: boolean) => void;
  /** What the row reads when it is auto, whether or not it is now: the last line of its help tooltip, after the
   *  word `auto`. */
  autoValue?: ReactNode;
  /** Given, a `ResetControl` after the label calls it: the owner passes it while the row's value is not what a
   *  reset makes it (`prefIsReset`), and puts the setting back as its schema says. */
  onReset?: () => void;
  /** The row's value differs from a baseline of the owner's: its label is drawn in the accent color. */
  changed?: boolean;
  /** What is wrong with the row's value — a validation message, shown under the control as an alert. The row
   *  carries `data-invalid` while it has one. */
  error?: ReactNode;
}

/** Props for {@link RowScope}. */
export interface RowScopeProps extends RowState {
  children?: ReactNode;
}

const StateContext = createContext<RowState | null>(null);

/** Sets the state of the settings row inside it — `<PropertyRow>`, `<PropertyField>`, `<DialogRow>`, or a
 *  selection panel's row. A scope inside another overrides the fields it names, and a row takes the state for
 *  itself: a row nested in its control starts with none. */
export function RowScope({ children, ...state }: RowScopeProps): ReactElement {
  const outer = useContext(StateContext);
  const { auto, onAutoChange, autoValue, onReset, changed, error } = state;
  // A field passed as `undefined` still overrides the outer scope's, so which fields were named is a dependency.
  const named = Object.keys(state).join();
  const value = useMemo(() => {
    const given: RowState = { auto, onAutoChange, autoValue, onReset, changed, error };
    const own = new Set(named.split(','));
    const next: RowState = { ...outer };
    for (const key of Object.keys(given) as (keyof RowState)[]) {
      if (own.has(key)) Object.assign(next, { [key]: given[key] });
    }
    return next;
  }, [outer, named, auto, onAutoChange, autoValue, onReset, changed, error]);
  return <StateContext.Provider value={value}>{children}</StateContext.Provider>;
}

/** What a row tells the controls inside it: the label it shows, and its state. */
export interface PropertyRowScope extends RowState {
  label: ReactNode;
}

const RowContext = createContext<PropertyRowScope | null>(null);

/** The state a row draws, from the {@link RowScope} around it. For a row component, which hands its children
 *  {@link InsideRow}. */
export function useRowState(): RowState {
  return useContext(StateContext) ?? NONE;
}

const NONE: RowState = {};

/** What a row wraps its control in: the row it sits in, for the control to read, and no state for a row nested
 *  inside it. */
export function InsideRow({ scope, children }: { scope: PropertyRowScope; children?: ReactNode }): ReactElement {
  return (
    <StateContext.Provider value={null}>
      <RowContext.Provider value={scope}>{children}</RowContext.Provider>
    </StateContext.Provider>
  );
}

/** The row a control sits in, or `null` for one standing alone. A control that would draw a label of its own
 *  leaves it to the row's. */
export function usePropertyRow(): PropertyRowScope | null {
  return useContext(RowContext);
}
