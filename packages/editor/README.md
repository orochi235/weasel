# @weasel-js/editor

The frame and glue a weasel editor app needs around its canvas: a shell with
the kit's providers, command keys that work before any canvas is pressed, a
menu bar, a topbar, and a preferences dialog; saving the document as it changes
and restoring it on reload, opening and saving files, a document of several
pages, fitting the view to a page, and the page's paper and grid.

Part of [weasel](https://github.com/orochi235/weasel), a domain-agnostic
scene-graph engine for React. See the
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
| Session | `useSessionPersistence`, `useAutosave`, `readStored`, `writeSession`, `isUnreadableKey`, `sessionSaveReporter` |
| Snapshots | `docFromSnapshot`, `nodeSpecsFromSnapshot`, `adoptSnapshotPages`, `snapshotRebuildsTree` |
| Clipboard | `useDocClipboard`, `DOC_CLIPBOARD_ACTIONS`, `DOC_CLIPBOARD_KEYS` |
| Files | `downloadBlob`, `pickFile`, `describeFileWarnings`, `reportFileWarnings` |
| File commands | `useNewCommand`, `useOpenCommand`, `useSaveCommand`, `FILE_KEYS` |
| Pages | `usePages`, `usePageSettle`, `PAGE_SETTLE_MS`, `usePageFit`, `usePaperLayer`, `usePageGrid` |
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
them. Given `prefs`, it registers `editor.preferences` (Mod+,) to open the
preferences dialog; it registers `shortcuts.show` (Shift+/) to open the keyboard
shortcut sheet unless `shortcuts={null}`; and it draws the menu bar from `menus` on its own row, or, with `menuBar="inline"`,
hands it to a `topbar` function to place.

Every `<SceneCanvas>` in the shell gets the editor's context menus:
`editor.selection` on a right-click on the selection (Cut, Copy, Paste,
Duplicate, Delete; Group, Ungroup; Bring Forward, Bring to Front, Send Backward,
Send to Back) and `editor.canvas` on empty canvas (Paste, Select All; Undo,
Redo). An item whose action the canvas does not register drops out. To add to
one, contribute a `MenuDef` with the same id on a canvas `ambient` entry; its
sections follow the editor's, after a separator. To replace them, pass
`contextMenus={false}` and contribute your own.

In a development build every canvas in the shell also registers with the
devtools hook, for the devtools panel and the browser extension
(`ShellDevtools`, from `@weasel-js/devtools/mount`; production bundles never
load the hook). `devtools={false}` turns that off, and `true` keeps it in
production; an app that provides `devtoolsOff` above the shell turns it off
there and in every other shell under it.

```ts
const enter = pref.group('', { path: pref.action('enterPathEdit') });
const ambient = [{
  id: 'myapp.menus', eligibility: { always: true },
  menus: [{ id: 'editor.selection', when: { bodyTarget: 'selected-body' }, menu: pref.group('', { enter }) }],
}];
```

## Saving the session

The session hooks keep the document in `localStorage` unless they are given a
`RecordCache` from `@weasel-js/storage` to keep it in instead.
`useSessionPersistence` saves the scene and its undo stack 300 ms after each
change, and at once when the page goes away or turns hidden; on mount it
restores the undo stack. The scene itself is read before the scene is made,
and handed to `useScene`:

```tsx
function loadSaved() {
  return readStored('myapp:scene', (value) => {
    const json = decodeSnapshot(value);
    if (!isSerializedScene<Data, Layer, RectPose>(json)) throw new Error('not a saved document');
    return { initial: nodeSpecsFromSnapshot(json), doc: docFromSnapshot(json) };
  }, () => ({ initial: [], doc: undefined }));
}

function useDocument() {
  const [saved] = useState(loadSaved);
  const scene = useScene<Data, Layer, RectPose>({ systemLayers, initial: saved.initial, ...(saved.doc && { doc: saved.doc }) });
  useSessionPersistence(scene, { sceneKey: 'myapp:scene', historyKey: 'myapp:history' });
  return scene;
}
```

An entry is a value JSON reads back as itself, so every adapter keeps it
exactly: `readStored` hands its reader the value, not text. The scene and its
undo stack are written through core's `encodeSceneDocument`, the stack paired
with the scene, and the snapshot readers here take a snapshot core's
`decodeSnapshot` has decoded (`docs/scene-serialization.md`). On mount the stack
is restored only onto the scene it was saved beside (`restorePairedHistory`):
one beside a scene that loaded otherwise, rebuilt, migrated, unreadable or
replaced, is dropped.

To keep the session in IndexedDB, which holds far more than `localStorage`'s
few megabytes (a document with a few embedded photos passes that), open the
records before the scene is made, and pass them to every call. Their reads are
synchronous once open, and the keys are the records' names:

```tsx
const records = await openRecords({ storage: indexedDbAdapter, prefix: 'myapp:' });

function loadSaved() {
  return readStored('scene', readScene, () => ({ initial: [], doc: undefined }), records);
}
// …
useSessionPersistence(scene, { sceneKey: 'scene', historyKey: 'history', records });
```

`useAutosave` and `writeSession` take `records` too. A save removes the undo
stack before it writes the scene and writes the stack once the scene has
landed, so storage that writes each record on its own never holds a stack
beside a scene it was not saved with, even when the page goes away partway.
When the scene's write fails, the scene and stack are put back as they were.
`onSaved` hears each save once its entries have landed or failed.

An entry `readStored` cannot read is kept aside under `<key>:unreadable`, in
the same records, rather than lost to the next save. Until that copy has
landed, `writeSession` and `useAutosave` neither write over nor remove `<key>`:
each save tries the copy again first and answers false while it will not save,
so `onSaved` hears the failure. Once it lands, saves go through as usual.
`writeSession` removes a document given `undefined` for its value, under the
same rule.

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
composition, its `composition`), `docFromSnapshot` leaves the value out, and the undo stack saved beside it
no longer pairs with the scene, so `useSessionPersistence` drops it.
