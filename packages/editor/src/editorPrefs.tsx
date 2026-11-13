import { createContext, useContext, useState } from 'react';
import { openPrefsSync, type PrefGroup, type PrefsStore } from '@weasel-js/prefs';
import { usePrefsValues, type PrefsFormBinding } from '@weasel-js/prefs/react';
import { PrefsDialog, type PrefsDialogProps } from '@weasel-js/ui/components/Prefs';

/** What `openPrefsSync` takes besides the schema. */
export type EditorPrefsOptions = Parameters<typeof openPrefsSync>[1];

/** An editor's preferences: a store already open, or what `openPrefsSync` needs to open one. Options are read once,
 *  on mount, and the store they open is kept for the page's life; pass a store where the shell can remount. */
export type EditorPrefs<S extends PrefGroup = PrefGroup> = PrefsStore<S> | ({ schema: S } & EditorPrefsOptions);

/** What the preferences dialog takes past the store's own binding: `layout`, `renderers` for the app's own kinds,
 *  `headerExtra`, `showHidden`, and the rest of `PrefsDialog`'s props. `layout` defaults to `'rail'`. */
export type EditorPrefsDialogProps = Partial<
  Omit<PrefsDialogProps, 'isOpen' | 'onOpenChange' | keyof PrefsFormBinding>
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

/** `PrefsDialog` bound to `store`: each change is written at once, turning a leaf's Auto on resets it, and a
 *  scoped leaf splits into its members. */
export function EditorPrefsDialog({ store, isOpen, onOpenChange, dialog }: {
  store: PrefsStore<PrefGroup>;
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  dialog?: EditorPrefsDialogProps;
}) {
  const { form } = usePrefsValues(store);
  return <PrefsDialog layout="rail" {...dialog} {...form} isOpen={isOpen} onOpenChange={onOpenChange} />;
}
