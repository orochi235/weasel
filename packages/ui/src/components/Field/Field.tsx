import type { ReactNode } from 'react';
import { FieldScope, shows, useFieldIds } from './fieldSemantics';
import { NativeFieldFoot } from './fieldSlots';
import s from './Field.module.css';

/**
 * Whether a {@link Field} stacks its label above the control or sits them
 * side by side.
 */
export type FieldOrientation = 'stacked' | 'row';

/** Props for {@link Field}. */
export type FieldProps = {
  orientation?: FieldOrientation;
  /** Names the field's control, or its group with `group`. */
  label?: ReactNode;
  /** The control's current value as it should read beside the label; equal-width digits. */
  output?: ReactNode;
  /** A line under the control, and its accessible description. */
  description?: ReactNode;
  /** What is wrong with the value: shown under the control, which it describes and marks invalid. */
  error?: ReactNode;
  /**
   * The field holds several controls, each naming itself: it becomes a `group` named by `label` and described by
   * `description` and `error`, and hands its controls nothing. Without it the field holds one control, which takes
   * its name, description and error from the field.
   */
  group?: boolean;
  className?: string;
  children?: ReactNode;
};

/**
 * Layout primitive that arranges a label, control, hint, and error in the
 * canonical weasel-ui form-row shape, and names the control from that label.
 *
 * The control inside reads the field through `useFieldControl`, as `Input`,
 * `NumberField`, `UnitField`, `Select`, `Slider`, `InlineRange`, `SegmentedBar`, `Switch`, and `Checkbox` do:
 * the label names it, the description and error describe it, and the label is
 * written once.
 *
 * ```tsx
 * <Field label="Opacity" output={`${v}%`}><Slider … /></Field>
 * ```
 *
 * A field of several controls takes `group`, and each control names itself:
 *
 * ```tsx
 * <Field label="Position" group><UnitField aria-label="X" … /><UnitField aria-label="Y" … /></Field>
 * ```
 *
 * `Input`, `Checkbox`, and `Switch` lay themselves out when given a label of
 * their own. `RadioGroup` reads {@link fieldClasses} for the same rhythm.
 */
export function Field({ orientation = 'stacked', label, output, description, error, group = false, className, children }: FieldProps) {
  const named = label !== undefined;
  const invalid = shows(error);
  const ids = useFieldIds({ label: named, description: description !== undefined, error: invalid });
  const cls = [s.field, orientation === 'row' && s.row, (description !== undefined || invalid) && s.footed, className].filter(Boolean).join(' ');
  const labelEl = named && <span id={ids.labelId} className={s.label}>{label}</span>;
  // The control announces its own value; a live region here would say it twice through a drag.
  const outputEl = output !== undefined && <output aria-live="off" className={s.output}>{output}</output>;
  const foot = <NativeFieldFoot ids={ids} description={description} error={error} />;
  const root = group
    ? { role: 'group', 'aria-labelledby': ids.labelId, 'aria-describedby': ids.describedBy, ...(invalid ? { 'data-invalid': '' } : {}) }
    : invalid ? { 'data-invalid': '' } : {};
  const scope = group ? null : { id: ids.id, labelId: ids.labelId, describedBy: ids.describedBy, invalid: ids.invalid };
  const body = <FieldScope value={scope}>{children}</FieldScope>;
  if (orientation === 'row') {
    return <div className={cls} {...root}>{labelEl}{body}{outputEl}{foot}</div>;
  }
  return (
    <div className={cls} {...root}>
      {(labelEl || outputEl) && <div className={s.head}>{labelEl}{outputEl}</div>}
      {body}
      {foot}
    </div>
  );
}

/**
 * The class names {@link Field} paints its slots with, so a control composing
 * its own layout can match the same form-row rhythm.
 */
export const fieldClasses = {
  root: s.field,
  row: s.row,
  label: s.label,
  hint: s.hint,
  error: s.error,
};
