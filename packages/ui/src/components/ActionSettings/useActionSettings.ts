import { useCallback, useMemo, useSyncExternalStore } from 'react';
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
  const snapshot = (): string => {
    if (!action || !settings) return '';
    const deps = depReg ? buildDepsFromRequires(action, depReg) : undefined;
    return JSON.stringify(readActionSettings(action, deps));
  };
  const key = useSyncExternalStore(depReg?.subscribe ?? noSubscribe, snapshot, snapshot);
  const state = useMemo(() => {
    if (key === '') return null;
    const parsed = JSON.parse(key) as { values: Record<string, unknown>; mixed?: string[] };
    return { values: parsed.values, mixed: new Set(parsed.mixed ?? []) };
  }, [key]);
  const id = action?.id;
  const params = item?.params;
  const onChange = useCallback((path: string, value: unknown) => {
    if (!settings || id === undefined) return;
    const made = actionSettingsParams(settings, path, value);
    if (made) registry?.trigger(id, { ...params, ...made });
  }, [registry, settings, id, params]);
  return settings && state ? { schema: settings.schema, ...state, onChange } : null;
}
