# @weasel-js/editor

## 1.15.2

### Patch Changes

- Updated dependencies [946faff]
- Updated dependencies [507f539]
- Updated dependencies [c6edab2]
- Updated dependencies [a4138b6]
- Updated dependencies [5a0375b]
- Updated dependencies [f1906a8]
- Updated dependencies [e804540]
- Updated dependencies [8425714]
- Updated dependencies [a47cce1]
- Updated dependencies [2f6b10d]
- Updated dependencies [5f6111b]
  - @weasel-js/core@1.15.2
  - @weasel-js/ui@1.15.2
  - @weasel-js/geom@1.15.2
  - @weasel-js/guides@1.15.2
  - @weasel-js/prefs@1.15.2

## 1.15.1

### Patch Changes

- 5226c83: `useNewCommand`, `useOpenCommand` and `useSaveCommand` register a document's New, Open and Save the way `useCommand` does, bound to Cmd/Ctrl+N, O and S unless `keys` names others; `keys: null` binds none. `FILE_KEYS` holds the three defaults.
- abfdaa2: New package: the session, file and page glue weasel's editor apps share, published as `@weasel-js/editor`. It saves a document as it changes and restores it on reload (`useSessionPersistence`, `useAutosave`), revives snapshots (`docFromSnapshot`, `nodeSpecsFromSnapshot`), opens and saves files (`downloadBlob`, `pickFile`), and runs a document's pages, their fit, paper and grid (`usePages`, `usePageFit`, `usePaperLayer`, `usePageGrid`).
- 027c59a: `@weasel-js/editor` adds `<EditorShell>`, the frame of an editor app. It mounts the kit's providers where none is
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
- Updated dependencies [424ba52]
- Updated dependencies [9515681]
- Updated dependencies [5e66a10]
- Updated dependencies [2992b55]
- Updated dependencies [8ad43af]
- Updated dependencies [8b52282]
- Updated dependencies [999fba9]
- Updated dependencies [8c13aee]
- Updated dependencies [120420a]
- Updated dependencies [b6a97f4]
- Updated dependencies [e982d8a]
- Updated dependencies [89e647e]
- Updated dependencies [fa1c9a7]
- Updated dependencies [ec16ac7]
- Updated dependencies [6f496e1]
- Updated dependencies [4b2a4e3]
- Updated dependencies [cb3b4a7]
  - @weasel-js/core@1.15.1
  - @weasel-js/guides@1.15.1
  - @weasel-js/ui@1.15.1
  - @weasel-js/geom@1.15.1
  - @weasel-js/prefs@1.15.1
