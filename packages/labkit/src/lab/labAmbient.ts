/**
 * Ambient contributions installed into the lab's key dispatcher from below it:
 * a keymap and its leader, say. Their bindings route on the lab's dispatcher,
 * and their actions register on the lab's registry.
 */
import { useActionsRegistry } from '@weasel-js/core';
import type { Contribution } from '@weasel-js/routing';
import { createContext, useContext, useEffect, useMemo, useState } from 'react';

export interface LabAmbient {
  install(entries: readonly Contribution<never>[]): () => void;
}

export const LabAmbientContext = createContext<LabAmbient | null>(null);

/** The installed entries by id, and the installer that changes them. */
export function useLabAmbientHost(): {
  entriesById: ReadonlyMap<string, Contribution<never>>;
  host: LabAmbient;
} {
  const [installed, setInstalled] = useState<readonly (readonly Contribution<never>[])[]>([]);
  const host = useMemo<LabAmbient>(
    () => ({
      install: (entries) => {
        setInstalled((prev) => [...prev, entries]);
        return () => setInstalled((prev) => prev.filter((e) => e !== entries));
      },
    }),
    [],
  );
  const entriesById = useMemo(
    () => new Map(installed.flat().map((e) => [e.id, e] as const)),
    [installed],
  );
  return { entriesById, host };
}

/** Installs `entries` on the lab for as long as the caller is mounted. Pass a
 *  stable array: a new one reinstalls. Outside a lab it does nothing. */
export function useLabAmbient(entries: readonly Contribution<never>[]): void {
  const ambient = useContext(LabAmbientContext);
  const registry = useActionsRegistry();
  useEffect(() => {
    if (!ambient || !registry) return;
    const offs = entries.flatMap((e) => (e.actions ?? []).map((a) => registry.register(a)));
    const uninstall = ambient.install(entries);
    return () => {
      uninstall();
      for (const off of offs) off();
    };
  }, [ambient, registry, entries]);
}
