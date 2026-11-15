import { createContext, useContext, useId, type ReactElement, type ReactNode } from 'react';
import { describedBy } from '../Disabled/HoldReason';

/**
 * What a field tells the one control inside it: the id its focusable element takes, the element naming it, and
 * what describes it. Set by {@link Field} and `PropertyRow`, read through {@link useFieldControl}.
 */
export interface FieldSemantics {
  /** The id the control's focusable element takes, which the field's label points at. */
  id?: string;
  /** The id of the field's visible label. */
  labelId?: string;
  /** The ids of the field's description and error, in `aria-describedby`'s form. */
  describedBy?: string;
  /** The field shows an error. */
  invalid?: boolean;
}

const FieldContext = createContext<FieldSemantics | null>(null);

/** Props for {@link FieldScope}. */
export interface FieldScopeProps {
  /** What the control inside takes; `null` stops a field further out from reaching it. */
  value: FieldSemantics | null;
  children?: ReactNode;
}

/**
 * Hands a field's semantics to the control inside it. {@link Field} sets one; a component drawing its own label
 * around one control sets one too, and a control made of several fields sets `null` around them, so that none of
 * them takes the name meant for the whole.
 */
export function FieldScope({ value, children }: FieldScopeProps): ReactElement {
  return <FieldContext.Provider value={value}>{children}</FieldContext.Provider>;
}

/** The semantics of the field around a control, or `null` for one standing alone. */
export function useFieldSemantics(): FieldSemantics | null {
  return useContext(FieldContext);
}

/** What a control says about its own name and description, which {@link useFieldControl} merges with its field's. */
export interface OwnFieldSemantics {
  id?: string;
  'aria-label'?: string;
  'aria-labelledby'?: string;
  'aria-describedby'?: string;
  /** The control draws a label of its own. */
  labeled?: boolean;
}

/** The attributes a control's focusable element takes from {@link useFieldControl}. */
export interface FieldControlAttrs {
  id?: string;
  'aria-label'?: string;
  'aria-labelledby'?: string;
  'aria-describedby'?: string;
  'aria-invalid'?: true;
}

/**
 * The name, id and description a control's focusable element takes: the field's around it, merged with the
 * control's own. A control that names itself — an `aria-label`, an `aria-labelledby`, or a label it draws — is
 * not the field's control and takes nothing from it, so a member of a compound control keeps its own name.
 *
 * ```tsx
 * function Knob(props: { 'aria-label'?: string }) {
 *   return <div role="slider" tabIndex={0} {...useFieldControl(props)} />;
 * }
 * <Field label="Gain" description="In decibels."><Knob /></Field>
 * ```
 */
export function useFieldControl(own: OwnFieldSemantics = {}): FieldControlAttrs {
  const field = useFieldSemantics();
  const named = own.labeled || own['aria-label'] !== undefined || own['aria-labelledby'] !== undefined;
  const taken = named ? null : field;
  const attrs: FieldControlAttrs = {};
  const id = own.id ?? taken?.id;
  if (id !== undefined) attrs.id = id;
  if (own['aria-label'] !== undefined) attrs['aria-label'] = own['aria-label'];
  const labelledBy = own['aria-labelledby'] ?? taken?.labelId;
  if (labelledBy !== undefined) attrs['aria-labelledby'] = labelledBy;
  const described = describedBy(taken?.describedBy, own['aria-describedby']);
  if (described !== undefined) attrs['aria-describedby'] = described;
  if (taken?.invalid) attrs['aria-invalid'] = true;
  return attrs;
}

/** The ids a field draws its parts with: the control's, and its label's, description's and error's where it has them. */
export interface FieldIds extends FieldSemantics {
  descriptionId?: string;
  errorId?: string;
}

/**
 * Ids for a field drawing its own label, description and error: the semantics to hand its control, and the id
 * each part it draws takes. `id` is the control's, generated when not given.
 */
export function useFieldIds({
  id,
  label,
  description,
  error,
}: {
  id?: string;
  label: boolean;
  description: boolean;
  error: boolean;
}): FieldIds {
  const base = useId();
  const descriptionId = description ? `${base}-description` : undefined;
  const errorId = error ? `${base}-error` : undefined;
  return {
    id: id ?? `${base}-control`,
    labelId: label ? `${base}-label` : undefined,
    descriptionId,
    errorId,
    describedBy: describedBy(descriptionId, errorId),
    invalid: error || undefined,
  };
}

/** Whether an error slot has anything to show. */
export function shows(error: ReactNode): boolean {
  return error != null && error !== false && error !== '';
}
