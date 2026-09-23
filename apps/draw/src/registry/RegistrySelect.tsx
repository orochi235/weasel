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
import { Input, Select, type SelectOption } from '@weasel-js/ui';
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
  /** Accessible name for the control. */
  'aria-label'?: string;
  /** Ordering of the rendered options. Defaults to `'label'` —
   *  case-insensitive alphabetical by label — which makes long lists
   *  scannable. Use `'value'` to sort by id, or `'source'` to preserve
   *  whatever order the resolver returned (e.g. for inherently-ordered
   *  registries like history entries). */
  sortBy?: 'label' | 'value' | 'source';
}

export function RegistrySelect({
  value,
  onChange,
  source,
  filter,
  'aria-label': ariaLabel,
  sortBy = 'label',
}: RegistrySelectProps) {
  const sources = useContext(RegistryEnumSourcesContext);
  const resolver = sources[source];
  if (!resolver) {
    return <Input value={value} onChange={onChange} aria-label={ariaLabel} />;
  }
  const raw = resolver(filter);
  const sorted = sortBy === 'source'
    ? raw
    : [...raw].sort((a, b) => {
        const av = sortBy === 'value' ? a.value : a.label;
        const bv = sortBy === 'value' ? b.value : b.label;
        return av.localeCompare(bv, undefined, { sensitivity: 'base' });
      });
  const options: SelectOption[] = sorted.map((o) => ({ value: o.value, label: o.label }));
  if (!sorted.some((o) => o.value === value)) {
    options.unshift({ value, label: `${value} (not in registry)`, isDisabled: true });
  }
  return (
    <Select<string>
      options={options}
      selectedKey={value}
      onSelectionChange={onChange}
      aria-label={ariaLabel}
    />
  );
}
