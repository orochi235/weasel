import { createContext, useContext, useState, useSyncExternalStore } from 'react';
import { prefValueAtPath, type PrefGroup, type PrefPath, type PrefsStore } from '@weasel-js/prefs';
import { Icon } from '../../icons';
import { ToolButton } from '../ToolButton';
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
    // What the reader has dragged each pane to, in pixels. Hidden: the handles are where they are set.
    layout: {
      name: 'Layout',
      children: {
        structureWidth: { kind: 'number', name: 'structureWidth', description: '', default: 300, hidden: true },
        attributesWidth: { kind: 'number', name: 'attributesWidth', description: '', default: 320, hidden: true },
        sidebarWidth: { kind: 'number', name: 'sidebarWidth', description: '', default: 240, hidden: true },
        previewWidth: { kind: 'number', name: 'previewWidth', description: '', default: 800, hidden: true },
        unplacedHeight: { kind: 'number', name: 'unplacedHeight', description: '', default: 180, hidden: true },
        shelfHeight: { kind: 'number', name: 'shelfHeight', description: '', default: 180, hidden: true },
        shelfSettingsWidth: { kind: 'number', name: 'shelfSettingsWidth', description: '', default: 240, hidden: true },
        shelfActionsWidth: { kind: 'number', name: 'shelfActionsWidth', description: '', default: 240, hidden: true },
      },
    },
  },
} as const satisfies PrefGroup;

type Schema = typeof PREF_SCHEMA_EDITOR_PREFS;
/** A prefs store opened over {@link PREF_SCHEMA_EDITOR_PREFS}. */
export type PrefSchemaEditorPrefs = PrefsStore<typeof PREF_SCHEMA_EDITOR_PREFS>;

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

const EditorPrefsContext = createContext<EditorPrefs | null>(null);

/** Gives the editor's panes its settings. */
export const EditorPrefsProvider = EditorPrefsContext.Provider;

/** A pane size the editor keeps in its settings. */
export type EditorSize = keyof typeof PREF_SCHEMA_EDITOR_PREFS.children.layout.children;

/**
 * One of the editor's sizes as a `ResizeHandle` takes it: it follows the drag, and is written to the settings once
 * when the drag ends. The settings are `given`, or else the ones a provider above holds; with neither the size
 * lasts as long as the pane is mounted.
 */
export function useEditorSize(key: EditorSize, given?: EditorPrefs): { value: number; onInput(next: number): void; onChange(next: number): void } {
  const above = useContext(EditorPrefsContext);
  const prefs = given ?? above;
  const path = `layout.${key}`;
  const kept = prefValueAtPath(prefs?.values, path);
  const [live, setLive] = useState<number | null>(null);
  return {
    value: live ?? (typeof kept === 'number' ? kept : PREF_SCHEMA_EDITOR_PREFS.children.layout.children[key].default),
    onInput: setLive,
    onChange: (next) => prefs?.set(path, next),
  };
}

/** The bar's tool for the editor's own settings, and the dialog it opens. */
export function EditorPrefsButton({ prefs }: { prefs: EditorPrefs }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <ToolButton icon={<Icon name="tune" />} label="Preferences" onClick={() => setOpen(true)} />
      <PrefsDialog isOpen={open} onOpenChange={setOpen} layout="list" schema={PREF_SCHEMA_EDITOR_PREFS} values={prefs.values} onChange={prefs.set} />
    </>
  );
}
