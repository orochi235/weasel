import { useCallback, useMemo, useState, type ReactNode } from 'react';
import { WeaselProvider } from '@weasel-js/core';
import type { PrefGroup } from '@weasel-js/prefs';
import { ContextMenuHost } from '@weasel-js/ui/components/ContextMenu';
import { MenuBar } from '@weasel-js/ui/components/MenuBar';
import { type EditorCommandOptions, PreferencesCommand, useEditorKeys } from './editorCommands';
import {
  type EditorPrefs, EditorPrefsContext, EditorPrefsDialog, type EditorPrefsDialogProps, useOpenedPrefs,
} from './editorPrefs';
import { editorMenuBar, type MenuContributions, type MenuTitle } from './menuBar';

/** Props for {@link EditorShell}. */
export interface EditorShellProps<S extends PrefGroup = PrefGroup> {
  /** The app's preferences. With them the shell registers `editor.preferences` and draws its dialog. */
  prefs?: EditorPrefs<S>;
  /** The preferences dialog's own props: its layout, renderers for the app's kinds, a header switch. */
  prefsDialog?: EditorPrefsDialogProps;
  /** How `editor.preferences` registers; `null` registers none. Ignored without `prefs`. */
  preferences?: EditorCommandOptions | null;
  /** What each menu holds, by title key. Without it there is no menu bar. Pass a new value to change the menus. */
  menus?: MenuContributions;
  /** The menu titles and their order. Default `EDITOR_MENU_TITLES`. */
  menuTitles?: readonly MenuTitle[];
  /**
   * Where the menu bar goes. `'row'` (default): on its own row, above the topbar. `'inline'`: in the topbar. A
   * `topbar` function is handed the bar to place; a plain one is drawn after it.
   */
  menuBar?: 'row' | 'inline';
  menuBarClassName?: string;
  /** The row of controls under the menu bar. A function receives the menu bar when it is inline, else `null`. */
  topbar?: ReactNode | ((menuBar: ReactNode) => ReactNode);
  children?: ReactNode;
}

/**
 * The frame of an editor app: the kit's providers where none is in scope already (deps, actions, the active tool,
 * the selection, and the pointer), a dispatcher that runs the app's command keys with no canvas holding them, the
 * menu bar and topbar, the preferences store and dialog, and the context menu host. `children` render below the
 * topbar. Draws no element of its own: what it renders is laid out by the app's container.
 */
export function EditorShell<S extends PrefGroup = PrefGroup>(props: EditorShellProps<S>) {
  return (
    <WeaselProvider>
      <ShellBody {...(props as EditorShellProps)} />
    </WeaselProvider>
  );
}

function ShellBody({
  prefs, prefsDialog, preferences, menus, menuTitles, menuBar = 'row', menuBarClassName, topbar, children,
}: EditorShellProps) {
  useEditorKeys();
  const store = useOpenedPrefs(prefs);
  const [prefsOpen, setPrefsOpen] = useState(false);
  const open = useCallback(() => setPrefsOpen(true), []);
  const prefsValue = useMemo(() => (store ? { store, open } : null), [store, open]);
  const schema = useMemo(() => (menus ? editorMenuBar(menus, menuTitles) : null), [menus, menuTitles]);
  const bar = schema && <MenuBar schema={schema} {...(menuBarClassName ? { className: menuBarClassName } : {})} />;
  const inline = menuBar === 'inline';
  const top = typeof topbar === 'function' ? topbar(inline ? bar : null) : <>{inline && bar}{topbar}</>;

  return (
    <EditorPrefsContext.Provider value={prefsValue}>
      {!inline && bar}
      {top}
      {children}
      {store && preferences !== null && <PreferencesCommand options={preferences} open={open} />}
      {store && (
        <EditorPrefsDialog store={store} open={prefsOpen} onClose={() => setPrefsOpen(false)} dialog={prefsDialog} />
      )}
      <ContextMenuHost />
    </EditorPrefsContext.Provider>
  );
}
