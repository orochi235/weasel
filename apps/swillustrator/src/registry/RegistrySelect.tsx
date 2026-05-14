/**
 * Presentation-agnostic dropdown for registry-enum values: pick a string
 * from a live registry (tools, fonts, history entries, …). Reads the
 * source resolver from `RegistryEnumSourcesContext` so callers don't have
 * to thread option lists through props. Used by the Preferences modal
 * today; intended for property-panel rows and any other UI that picks
 * an id from a registry tomorrow.
 *
 * Graceful degradation:
 *   - No resolver registered for the source → render a text input so the
 *     stored value is still visible/editable while the wiring catches up.
 *   - Stored value not in the resolver's current options → surface it as
 *     a disabled "(not in registry)" option so renames and removals
 *     don't silently rewrite state.
 */
import { createContext, useContext } from 'react';
import type {
  RegistryEnumFilter,
  RegistryEnumSources,
} from './types';

/** Sources keyed by `source` id. Wrap your subtree in
 *  `RegistryEnumSourcesContext.Provider` (or pass via the modal/component
 *  that owns the provider) so every `<RegistrySelect>` underneath can
 *  resolve. */
export const RegistryEnumSourcesContext =
  createContext<RegistryEnumSources>({});

export interface RegistrySelectProps {
  value: string;
  onChange: (next: string) => void;
  /** Source id — the key into the ambient `RegistryEnumSources` map. */
  source: string;
  /** Optional filter (criteria map or predicate); passed to the resolver. */
  filter?: RegistryEnumFilter;
  /** Override the `<select>`'s className. Falls back to a neutral class
   *  callers can style globally. */
  selectClassName?: string;
  /** Class for the text-input fallback when no resolver is registered. */
  inputClassName?: string;
}

export function RegistrySelect({
  value,
  onChange,
  source,
  filter,
  selectClassName,
  inputClassName,
}: RegistrySelectProps) {
  const sources = useContext(RegistryEnumSourcesContext);
  const resolver = sources[source];
  if (!resolver) {
    return (
      <input
        type="text"
        className={inputClassName}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    );
  }
  const options = resolver(filter);
  const hasCurrent = options.some((o) => o.value === value);
  return (
    <select
      className={selectClassName}
      value={value}
      onChange={(e) => onChange(e.target.value)}
    >
      {!hasCurrent && (
        <option value={value} disabled>{value} (not in registry)</option>
      )}
      {options.map((o) => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
  );
}
