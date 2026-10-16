/**
 * Wires the `kitSettings` dep: the store of the nearest `<KitSettingsProvider>`,
 * resolved at invocation so a provider swapped above the canvas reaches the next action.
 */
import { useDepSource } from '@weasel-js/routing/react';
import { useKitSettings, useLatest } from '@weasel-js/react';

export function useKitSettingsDepSource(): void {
  const ref = useLatest(useKitSettings());
  useDepSource('kitSettings', () => ref.current);
}
