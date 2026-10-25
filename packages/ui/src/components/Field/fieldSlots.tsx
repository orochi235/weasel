import type { ReactNode } from 'react';
import { FieldError, Text, type ValidationResult } from 'react-aria-components';
import type { FieldOrientation } from './Field';
import f from '../field.module.css';

/** The label, layout, description, and error slots every boxed form control takes. */
export type FieldSlotProps = {
  label?: ReactNode;
  /**
   * `'stacked'` (the default) puts the label above the control; `'row'` sets it
   * beside the control at its own width, with any description or error on a
   * line below. Same vocabulary as {@link Field}'s `orientation`.
   */
  orientation?: FieldOrientation;
  description?: ReactNode;
  errorMessage?: ReactNode | ((v: ValidationResult) => ReactNode);
};

/**
 * The root class of a boxed form control. `fit` is the control's own class for
 * `width='fit'`, added beside the shared one.
 */
export function fieldRootClass({
  orientation,
  width,
  fit,
  className,
}: {
  orientation?: FieldOrientation;
  width?: 'fill' | 'fit';
  fit?: string;
  className?: string;
}): string {
  return [
    f.field,
    f.control,
    width === 'fit' && [f.fit, fit].filter(Boolean).join(' '),
    orientation === 'row' && f.row,
    className,
  ]
    .filter(Boolean)
    .join(' ');
}

/** A control's description and error, under it or on a line of their own beside a row label. */
export function FieldFoot({
  description,
  errorMessage,
}: Pick<FieldSlotProps, 'description' | 'errorMessage'>) {
  return (
    <>
      {description !== undefined && (
        <Text slot="description" className={`${f.hint} ${f.below}`}>
          {description}
        </Text>
      )}
      <FieldError className={`${f.error} ${f.below}`}>{errorMessage}</FieldError>
    </>
  );
}
