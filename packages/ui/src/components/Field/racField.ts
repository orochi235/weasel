import { useFieldControl, type OwnFieldSemantics } from './fieldSemantics';
import type { FieldStateProps } from './fieldSlots';

/** What a React Aria field takes from the field around it. */
export interface RacFieldProps {
  id?: string;
  'aria-labelledby'?: string;
  'aria-describedby'?: string;
  isInvalid?: boolean;
  isRequired?: boolean;
}

/**
 * A React Aria field's id, name, description and state, from the kit field around it and its own props. React Aria
 * puts them on the field's input, and an error from the field shows as `isInvalid`. This is where the kit's
 * `invalid` and `required` become React Aria's `isInvalid` and `isRequired`.
 */
export function useRacField(own: OwnFieldSemantics & FieldStateProps): RacFieldProps {
  const attrs = useFieldControl(own);
  const props: RacFieldProps = {};
  if (attrs.id !== undefined) props.id = attrs.id;
  if (attrs['aria-labelledby'] !== undefined) props['aria-labelledby'] = attrs['aria-labelledby'];
  if (attrs['aria-describedby'] !== undefined) props['aria-describedby'] = attrs['aria-describedby'];
  const invalid = own.invalid ?? attrs['aria-invalid'];
  if (invalid !== undefined) props.isInvalid = invalid;
  if (own.required !== undefined) props.isRequired = own.required;
  return props;
}
