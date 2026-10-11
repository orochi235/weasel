import { useState, useSyncExternalStore } from 'react';
import { prefValueAtPath, type PrefGroup, type PrefPath, type PrefsStore } from '@weasel-js/prefs';
import { Button } from '../Button';
import { PrefsDialog } from '../Prefs';
import { setAtPath } from '../SelectionPanel';

/** The editor's own settings, as the schema a host opens a prefs store over to keep them. */
export const PREF_SCHEMA_EDITOR_PREFS = {
  name: 'Schema editor preferences',
  children: {
    preview: {
      name: 'Live preview',
      children: {
        selectDropped: {
          kind: 'boolean',
          name: 'Select what is dropped',
          description: 'A node dropped into the live preview becomes the selection. Off, the selection stays where it was.',
          default: true,
        },
      },
    },
  },
} as const satisfies PrefGroup;

type Schema = typeof PREF_SCHEMA_EDITOR_PREFS;
export type PrefSchemaEditorPrefs = PrefsStore<Schema>;

/** What the editor reads its settings through. */
export interface EditorPrefs {
  values: Record<string, unknown>;
  set(path: string, value: unknown): void;
  selectDropped: boolean;
}

const NOTHING: Record<string, unknown> = {};
const never = (): (() => void) => () => {};
const nothing = (): Record<string, unknown> => NOTHING;

/** The editor's settings from the host's `store`, or held for as long as the editor is mounted when it gives none. */
export function useEditorPrefs(store: PrefSchemaEditorPrefs | undefined): EditorPrefs {
  const [held, setHeld] = useState(NOTHING);
  const stored = useSyncExternalStore(store ? store.subscribe : never, store ? store.values : nothing);
  const values = store ? stored : held;
  return {
    values,
    set: (path, value) => {
      if (store) store.set(path as PrefPath<Schema>, value as never);
      else setHeld((v) => setAtPath(v, path.split('.'), value) as Record<string, unknown>);
    },
    selectDropped: prefValueAtPath(values, 'preview.selectDropped') !== false,
  };
}

/** The bar's button for the editor's own settings, and the dialog it opens. */
export function EditorPrefsButton({ prefs }: { prefs: EditorPrefs }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button size="sm" variant="ghost" onClick={() => setOpen(true)}>Preferences</Button>
      <PrefsDialog isOpen={open} onOpenChange={setOpen} layout="list" schema={PREF_SCHEMA_EDITOR_PREFS} values={prefs.values} onChange={prefs.set} />
    </>
  );
}
