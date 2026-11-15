import { useFieldControl, type OwnFieldSemantics } from './fieldSemantics';

/** What a React Aria field takes from the field around it. */
export interface RacFieldProps {
  id?: string;
  'aria-labelledby'?: string;
  'aria-describedby'?: string;
  isInvalid?: boolean;
}

/**
 * A React Aria field's id, name and description, from the kit field around it and its own props. React Aria
 * puts them on the field's input, and an error from the field shows as `isInvalid`.
 */
export function useRacField(own: OwnFieldSemantics & { isInvalid?: boolean }): RacFieldProps {
  const attrs = useFieldControl(own);
  const props: RacFieldProps = {};
  if (attrs.id !== undefined) props.id = attrs.id;
  if (attrs['aria-labelledby'] !== undefined) props['aria-labelledby'] = attrs['aria-labelledby'];
  if (attrs['aria-describedby'] !== undefined) props['aria-describedby'] = attrs['aria-describedby'];
  const invalid = own.isInvalid ?? attrs['aria-invalid'];
  if (invalid !== undefined) props.isInvalid = invalid;
  return props;
}
