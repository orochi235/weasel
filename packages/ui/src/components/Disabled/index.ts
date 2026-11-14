// The disabled and read-only scopes, the props every control and container takes, and the hooks a control reads.
export {
  Disabled, ReadOnly, useDisabled, useReadOnly, useControlAccess, holdScope,
  type DisableableProps, type ReadOnlyProps, type HoldProps, type DisabledScopeProps, type ReadOnlyScopeProps,
} from './Disabled';
export type { ControlAccess } from '@weasel-js/ui-logic';
