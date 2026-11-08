import { useCallback, useMemo, useRef, useSyncExternalStore } from 'react';
import { deepEqual } from '@weasel-js/registry';
import {
  actionSettingsParams,
  buildDepsFromRequires,
  readActionSettings,
  useActionsRegistry,
  useOptionalDepRegistry,
  type ActionItem,
} from '@weasel-js/core';
import type { PrefGroup } from '@weasel-js/prefs';

/** An action's settings form as a prefs form draws it. */
export interface ActionSettingsForm {
  schema: PrefGroup;
  values: Record<string, unknown>;
  mixed: ReadonlySet<string>;
  /** A prefs form's `onChange`: triggers the action with the params the change makes. */
  onChange: (path: string, value: unknown) => void;
}

const noSubscribe = (): (() => void) => () => {};

/**
 * The settings form `item`'s action carries, kept current as its deps change,
 * or `null` for an action with none. Every surface drawing an action's
 * settings reads them here, so none works out values or params of its own.
 */
export function useActionSettings(item: ActionItem | undefined): ActionSettingsForm | null {
  const registry = useActionsRegistry();
  const depReg = useOptionalDepRegistry();
  const action = item?.action;
  const settings = action?.settings;
  // The last read, handed back while a new one equals it, so the store sees a stable snapshot.
  const last = useRef<ReturnType<typeof readActionSettings>>(null);
  const snapshot = (): ReturnType<typeof readActionSettings> => {
    if (!action || !settings) return null;
    const deps = depReg ? buildDepsFromRequires(action, depReg) : undefined;
    const read = readActionSettings(action, deps);
    if (!deepEqual(read, last.current)) last.current = read;
    return last.current;
  };
  const read = useSyncExternalStore(depReg?.subscribe ?? noSubscribe, snapshot, snapshot);
  const state = useMemo(
    () => (read === null ? null : { values: read.values, mixed: new Set(read.mixed ?? []) }),
    [read],
  );
  const id = action?.id;
  const params = item?.params;
  const onChange = useCallback((path: string, value: unknown) => {
    if (!settings || id === undefined) return;
    const made = actionSettingsParams(settings, path, value);
    if (made) registry?.trigger(id, { ...params, ...made });
  }, [registry, settings, id, params]);
  return settings && state ? { schema: settings.schema, ...state, onChange } : null;
}
