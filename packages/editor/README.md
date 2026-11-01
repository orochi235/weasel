# @weasel-js/editor

The frame and glue a weasel editor app needs around its canvas: a shell with
the kit's providers, command keys that work before any canvas is pressed, a
menu bar, a topbar, and a preferences dialog; saving the document as it changes
and restoring it on reload, opening and saving files, a document of several
pages, fitting the view to a page, and the page's paper and grid.

Part of [weasel](https://github.com/orochi235/weasel), a domain-agnostic 2D
scene-graph canvas kit for React. See the
[API reference](https://orochi235.github.io/weasel/#pkg/editor).

## Install

```sh
npm install @weasel-js/editor
```

It runs beside `@weasel-js/core`, `@weasel-js/geom`, `@weasel-js/guides`,
`@weasel-js/prefs`, and `@weasel-js/ui`, which it takes as peers.

## What is in it

| Area | Exports |
|---|---|
| Shell | `EditorShell`, `EDITOR_ACTIONS`, `EDITOR_PREFERENCES_KEY`, `useEditorKeys` |
| Preferences | `useEditorPrefs`, `useOpenPreferences`, `EditorPrefsDialog` |
| Menu bar | `editorMenuBar`, `menu`, `menuRun`, `EDITOR_MENU_TITLES` |
| Session | `useSessionPersistence`, `useAutosave`, `readStored`, `writeSession` |
| Snapshots | `docFromSnapshot`, `nodeSpecsFromSnapshot`, `serializeReplacer`, `reviveTypedArrays` |
| Files | `downloadBlob`, `pickFile`, `describeFileWarnings`, `reportFileWarnings` |
| Pages | `usePages`, `usePageFit`, `usePaperLayer`, `usePageGrid` |
| Text editing | `TextEditDepPublisher` |

```tsx
<EditorShell
  prefs={{ schema: PREFS, storage: localStorageAdapter, prefix: 'myapp.prefs/' }}
  menus={{ file: { save: menuRun({ save: 'file.save' }) }, edit: { history: menuRun({ undo: 'undo', redo: 'redo' }) } }}
  topbar={<MyToolbar />}
>
  <MyWorkspace />
</EditorShell>
```

`EditorShell` mounts the kit's providers where none is in scope, and a
dispatcher that runs the keys of the commands registered on its registry while
no canvas holds the keys; once a canvas on that registry does, the canvas runs
them. It registers `editor.preferences` (Mod+,) to open the preferences dialog,
and draws the menu bar from `menus` on its own row, or, with `menuBar="inline"`,
hands it to a `topbar` function to place.

A saved snapshot keeps a path's typed arrays tagged (`serializeReplacer`), and
loading reads the tags back, along with the untagged shapes older saves wrote.
