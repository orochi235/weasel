import { useCallback, useMemo, useState, type ReactNode } from 'react';
import { AmbientContributionsProvider, WeaselProvider } from '@weasel-js/core';
import { ShellDevtools } from '@weasel-js/devtools/mount';
import type { PrefGroup } from '@weasel-js/prefs';
import { ContextMenuHost } from '@weasel-js/ui/components/Menu';
import { MenuBar } from '@weasel-js/ui/components/MenuBar';
import { EDITOR_CONTEXT_MENUS_CONTRIBUTION } from './contextMenus';
import { type EditorCommandOptions, PrefsCommand, useEditorKeys } from './editorCommands';
import {
  type EditorPrefs, EditorPrefsContext, EditorPrefsDialog, type EditorPrefsDialogProps, useOpenedPrefs,
} from './editorPrefs';
import { editorMenuBar, type MenuContributions, type MenuTitle } from './menuBar';
import { ShortcutSheetHost } from './shortcutSheet';

/** Props for {@link EditorShell}. */
export interface EditorShellProps<S extends PrefGroup = PrefGroup> {
  /** The app's preferences. With them the shell registers `editor.preferences` and draws its dialog. */
  prefs?: EditorPrefs<S>;
  /** The preferences dialog's own props: its layout, renderers for the app's kinds, a header switch. */
  prefsDialog?: EditorPrefsDialogProps;
  /** How `editor.preferences` registers; `null` registers none. Ignored without `prefs`. */
  preferences?: EditorCommandOptions | null;
  /**
   * How `shortcuts.show` registers, which opens the keyboard shortcut sheet: bound to Shift+/ unless `keys` says
   * otherwise. `null` registers none and draws no sheet. The sheet lists the tools `usePublishEditorTools` publishes.
   */
  shortcuts?: EditorCommandOptions | null;
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
  /**
   * Default `true`: every `<SceneCanvas>` in the shell gets the editor's context menus, `editor.selection` and
   * `editor.canvas` (`EDITOR_CONTEXT_MENUS`). An app adds to one by contributing a `MenuDef` with the same id in the
   * canvas's `ambient`, whose sections follow the editor's. `false` installs none, for an app supplying its own.
   */
  contextMenus?: boolean;
  /**
   * Register the shell's canvases with the devtools hook (`@weasel-js/devtools/mount`'s `ShellDevtools`), for the
   * devtools panel and the browser extension. Default: in a development build only, unless a `devtools` entry provided
   * above the shell (`devtoolsOff` among them) says otherwise. `false` withholds it; `true` mounts it in a production
   * build too.
   */
  devtools?: boolean;
  children?: ReactNode;
}

/**
 * The frame of an editor app: the kit's providers where none is in scope already (deps, actions, the active tool,
 * the selection, and the pointer), a dispatcher that runs the app's command keys with no canvas holding them, the
 * menu bar and topbar, the preferences store and dialog, the keyboard shortcut sheet, the context menu host, the default context menus
 * (`contextMenus`), and devtools in development (`devtools`). `children` render below the topbar. Draws no element of its own: what it renders is laid out by the app's container.
 */
export function EditorShell<S extends PrefGroup = PrefGroup>(props: EditorShellProps<S>) {
  return (
    <WeaselProvider>
      <ShellDevtools devtools={props.devtools}>
        <ShellBody {...(props as EditorShellProps)} />
      </ShellDevtools>
    </WeaselProvider>
  );
}

const DEFAULT_AMBIENT = [EDITOR_CONTEXT_MENUS_CONTRIBUTION];
const NO_AMBIENT: typeof DEFAULT_AMBIENT = [];

function ShellBody({
  prefs, prefsDialog, preferences, shortcuts = {}, menus, menuTitles, menuBar = 'row', menuBarClassName, topbar,
  contextMenus = true, children,
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
      <AmbientContributionsProvider contributions={contextMenus ? DEFAULT_AMBIENT : NO_AMBIENT}>
        <ShortcutSheetHost options={shortcuts}>
          {!inline && bar}
          {top}
          {children}
        </ShortcutSheetHost>
        {store && preferences !== null && <PrefsCommand options={preferences} open={open} />}
        {store && (
          <EditorPrefsDialog store={store} open={prefsOpen} onOpenChange={setPrefsOpen} dialog={prefsDialog} />
        )}
        <ContextMenuHost />
      </AmbientContributionsProvider>
    </EditorPrefsContext.Provider>
  );
}
