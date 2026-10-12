import type { ToolsApi } from '@weasel-js/core';
import { matchesRegistryFilter, type RegistryEnumSources } from './types';

/** The `tools` source for registry-enum prefs: every tool the palette shows,
 *  under the palette's label. Empty until the canvas has built its tools. */
export function toolEnumSources(tools: ToolsApi | null): RegistryEnumSources {
  if (!tools) return {};
  return {
    tools: (filter) => Object.values(tools.registry)
      .filter((t) => !t.presentation?.hide && matchesRegistryFilter(t, filter))
      .map((t) => ({ value: t.id, label: t.presentation?.label ?? t.id })),
  };
}
