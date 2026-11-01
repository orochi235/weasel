---
'@weasel-js/editor': patch
'@weasel-js/routing': patch
---

`@weasel-js/editor` adds `<EditorShell>`, the frame of an editor app. It mounts the kit's providers where none is
in scope, and a dispatcher that runs the keys of the commands registered on its registry with no canvas mounted or
pressed yet; once a canvas on that registry holds the keys, the canvas runs them, so a key never fires twice. Given
`prefs` (an open store, or what `openPrefsSync` takes), it registers `editor.preferences` ("Preferences…", Mod+, by
default; `preferences` changes its label, keys, icon, and group, or `null` drops it) and draws a `PrefsDialog` for it,
with `prefsDialog` passing the dialog's own props. `menus` gives each menu title's runs, drawn on the shell's own row
or, with `menuBar="inline"`, handed to a `topbar` function to place; a new `menus` value redraws the bar. The shell
also mounts the context menu host. `useEditorPrefs`, `useOpenPreferences`, `EDITOR_ACTIONS`, `EDITOR_PREFERENCES_KEY`, and the menu helpers
`editorMenuBar`, `menu`, `menuRun`, and `EDITOR_MENU_TITLES` come with it. The package now takes `@weasel-js/prefs`
as a peer.

`useGestureDispatcher` takes `yieldKeys`: a dispatcher with no canvas hears no key while a canvas dispatching on the
same registry holds the keys. `useCommand` takes `group`.
