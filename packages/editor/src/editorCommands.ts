import { type BoundGesture, type CommandOptions, useActionsRegistry, useCommand, useGestureDispatcher } from '@weasel-js/core';

/** The ids of the commands `<EditorShell>` registers. */
export const EDITOR_ACTIONS = { preferences: 'editor.preferences' } as const;

/** How the shell registers one of its commands. */
export interface EditorCommandOptions extends Pick<CommandOptions, 'icon' | 'group' | 'tags'> {
  label?: string;
  /** The gestures that run it, in place of its default; `null` binds none. */
  keys?: BoundGesture | readonly BoundGesture[] | null;
}

/** `editor.preferences`'s key unless `keys` says otherwise: Mod+,. */
export const EDITOR_PREFERENCES_KEY: BoundGesture = { kind: 'key', key: ',', mods: { mod: true } };

/** Registers `editor.preferences`, which calls `open`, bound to Mod+, unless `options.keys` says otherwise. */
export function PreferencesCommand({ options = {}, open }: { options?: EditorCommandOptions; open: () => void }): null {
  const { label = 'Preferences…', keys = EDITOR_PREFERENCES_KEY, ...rest } = options;
  useCommand(EDITOR_ACTIONS.preferences, label, open, { ...rest, ...(keys !== null ? { keys } : {}) });
  return null;
}

const NO_ELEMENT = { current: null };
const NO_ENTRIES = new Map();
const CHANNELS = { contextMenu: false, ingest: false } as const;

/**
 * The app's keys with no canvas holding them: a dispatcher on the registry in scope that runs what is registered
 * there. It listens first, so a canvas in a scope below does not run the same binding as well, and it hears nothing
 * while a canvas on this registry itself holds the keys, which then runs them with its own views and deps.
 */
export function useEditorKeys(): void {
  const registry = useActionsRegistry();
  if (!registry) throw new Error('useEditorKeys: no <ActionsProvider> in scope');
  useGestureDispatcher({
    canvasRef: NO_ELEMENT,
    actions: registry,
    entriesById: NO_ENTRIES,
    channels: CHANNELS,
    keyboard: 'first',
    hears: 'own',
    yieldKeys: true,
  });
}
