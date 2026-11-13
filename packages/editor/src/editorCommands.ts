import { type BoundGesture, type CommandOptions, type KeySpec, useActionsRegistry, useCommand, useGestureDispatcher } from '@weasel-js/core';

/** The ids of the commands `<EditorShell>` registers. */
export const EDITOR_ACTIONS = { preferences: 'editor.preferences' } as const;

/** How the shell registers one of its commands. */
export interface EditorCommandOptions extends Pick<CommandOptions, 'icon' | 'group' | 'tags'> {
  label?: string;
  /** The gestures that run it, in place of its default; `null` binds none. */
  keys?: BoundGesture | readonly BoundGesture[] | null;
}

/** `editor.preferences`'s key unless `keys` says otherwise: Mod+,. */
export const EDITOR_PREFERENCES_KEY: KeySpec = { kind: 'key', key: ',', mods: { mod: true } };

/** The key that turns snapping off and on: Mod+Shift+;, Photoshop's View › Snap. Shift turns ; into :, and
 *  `code` holds it to the key US layouts put ; on, whatever another layout types there. */
export const SNAPPING_KEY: KeySpec = { kind: 'key', key: [';', ':'], code: 'Semicolon', mods: { mod: true, shift: true } };

/** Registers `editor.preferences`, which calls `open`, bound to Mod+, unless `options.keys` says otherwise. */
export function PreferencesCommand({ options = {}, open }: { options?: EditorCommandOptions; open: () => void }): null {
  const { label = 'Preferences…', keys = { spec: EDITOR_PREFERENCES_KEY, opts: { id: `${EDITOR_ACTIONS.preferences}.key` } }, ...rest } = options;
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
