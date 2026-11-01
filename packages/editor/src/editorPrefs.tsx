import { createContext, useContext, useState } from 'react';
import { openPrefsSync, type PrefGroup, type PrefsStore } from '@weasel-js/prefs';
import { usePrefsValues } from '@weasel-js/prefs/react';
import { PrefsDialog, type PrefsDialogProps } from '@weasel-js/ui/components/Prefs';

/** What `openPrefsSync` takes besides the schema. */
export type EditorPrefsOptions = Parameters<typeof openPrefsSync>[1];

/** An editor's preferences: a store already open, or what `openPrefsSync` needs to open one. Options are read once,
 *  on mount, and the store they open is kept for the page's life; pass a store where the shell can remount. */
export type EditorPrefs<S extends PrefGroup = PrefGroup> = PrefsStore<S> | ({ schema: S } & EditorPrefsOptions);

/** What the preferences dialog takes past the store's own binding: `layout`, `renderers` for the app's own kinds,
 *  `headerExtra`, `showHidden`, and the rest of `PrefsDialog`'s props. `layout` defaults to `'rail'`. */
export type EditorPrefsDialogProps = Partial<
  Omit<PrefsDialogProps, 'isOpen' | 'onOpenChange' | 'schema' | 'values' | 'onChange' | 'auto' | 'onAutoChange'>
>;

interface EditorPrefsValue {
  store: PrefsStore<PrefGroup>;
  open(): void;
}

export const EditorPrefsContext = createContext<EditorPrefsValue | null>(null);

const isStore = <S extends PrefGroup>(prefs: EditorPrefs<S>): prefs is PrefsStore<S> => !('storage' in prefs);

/** `prefs` as a store: itself, or the one its options opened on the first render. */
export function useOpenedPrefs<S extends PrefGroup>(prefs: EditorPrefs<S> | undefined): PrefsStore<S> | null {
  const [opened] = useState(() => (prefs && !isStore(prefs) ? openPrefsSync(prefs.schema, prefs) : null));
  return prefs && isStore(prefs) ? prefs : opened;
}

/** The preferences store of the `<EditorShell>` above, or null outside one or when it was given none. `S` is the
 *  schema the caller knows the store holds. */
export function useEditorPrefs<S extends PrefGroup = PrefGroup>(): PrefsStore<S> | null {
  return (useContext(EditorPrefsContext)?.store ?? null) as PrefsStore<S> | null;
}

const NOTHING = (): void => {};

/** Opens the `<EditorShell>`'s preferences dialog. Does nothing outside one, or when it was given no prefs. */
export function useOpenPreferences(): () => void {
  return useContext(EditorPrefsContext)?.open ?? NOTHING;
}

/** `PrefsDialog` bound to `store`: each change is written at once, and turning a leaf's Auto on resets it. */
export function EditorPrefsDialog({ store, open, onClose, dialog }: {
  store: PrefsStore<PrefGroup>;
  open: boolean;
  onClose: () => void;
  dialog?: EditorPrefsDialogProps;
}) {
  const { values, set, unset, reset } = usePrefsValues(store);
  return (
    <PrefsDialog
      layout="rail"
      {...dialog}
      isOpen={open}
      onOpenChange={(next) => { if (!next) onClose(); }}
      schema={store.schema}
      values={values}
      onChange={set}
      auto={unset}
      onAutoChange={(path, next) => (next ? reset(path) : set(path, store.get(path as never)))}
    />
  );
}
