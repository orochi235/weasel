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
| Shell | `EditorShell`, `EDITOR_ACTIONS`, `EDITOR_PREFERENCES_KEY`, `SNAPPING_KEY`, `useEditorKeys`, `EDITOR_CONTEXT_MENUS`, `EDITOR_CONTEXT_MENUS_CONTRIBUTION` |
| Preferences | `useEditorPrefs`, `useOpenPreferences`, `EditorPrefsDialog` |
| Menu bar | `editorMenuBar`, `menu`, `menuRun`, `EDITOR_MENU_TITLES` |
| Session | `useSessionPersistence`, `useAutosave`, `readStored`, `writeSession` |
| Snapshots | `docFromSnapshot`, `nodeSpecsFromSnapshot`, `adoptSnapshotPages`, `serializeReplacer`, `reviveTypedArrays` |
| Files | `downloadBlob`, `pickFile`, `describeFileWarnings`, `reportFileWarnings` |
| File commands | `useNewCommand`, `useOpenCommand`, `useSaveCommand`, `FILE_KEYS` |
| Pages | `usePages`, `usePageSettle`, `usePageFit`, `usePaperLayer`, `usePageGrid` |
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

Every `<SceneCanvas>` in the shell gets the editor's context menus:
`editor.selection` on a right-click on the selection (Cut, Copy, Paste,
Duplicate, Delete; Group, Ungroup; Bring Forward, Bring to Front, Send Backward,
Send to Back) and `editor.canvas` on empty canvas (Paste, Select All; Undo,
Redo). An item whose action the canvas does not register drops out. To add to
one, contribute a `MenuDef` with the same id on a canvas `ambient` entry; its
sections follow the editor's, after a separator. To replace them, pass
`contextMenus={false}` and contribute your own.

```ts
const enter = pref.group('', { path: pref.action('enterPathEdit') });
const ambient = [{
  id: 'myapp.menus', eligibility: { always: true },
  menus: [{ id: 'editor.selection', when: { bodyTarget: 'selected-body' }, menu: pref.group('', { enter }) }],
}];
```

A saved snapshot keeps a path's typed arrays tagged (`serializeReplacer`), and
loading reads the tags back, along with the untagged shapes older saves wrote.

## Pages

A document is in one of two modes, read from its scene: **Continuous**, with no
pages, or **Pages**, where core's page run is a root holding one page node per
page, and what is on a page is that node's child, clipped to it. `usePages`
reads the page nodes and edits them through core's page edits; its `add()` on a
Continuous scene creates the page run, so the first page added makes the
document paged. `usePaperLayer` draws each page's paper, and `usePageFit` fits
the view to a page, or to the world origin when there is none.

Whether content may sit off every page, on a **pasteboard**, is the page run's
`pasteboard` flag in core (`createPageRun(scene, pages, { pasteboard: true })`).
It is off by default, and then nothing is left outside a page.

**Paging** is a view setting, not part of the document. `usePages(..., { paging })`
takes `'continuous'` (the default), where the view moves freely across pages,
or `'single'`, where `usePageSettle` brings the view to rest fitted to one page
150 ms after it last moved, never while a pointer is down; a view zoomed in past
the page's fit pans freely and is left alone. Pass a view dep with `animate` as
the view setter and going to a page, and the settle, animate.

A snapshot saved while a scene's pages were its `core:pages` document value
loads with them as page nodes: `nodeSpecsFromSnapshot` converts it through
core's `adoptLegacyPages` (pass the scene's `descriptor` and, off the rigid
composition, its `composition`), `docFromSnapshot` leaves the value out, and `useSessionPersistence`
drops the undo stack saved beside it.
