# @weasel-js/editor

## 2.0.0

### Major Changes

- f6eafc9: `useAutosave`'s delay is `debounceMs`, as storage's record cache names it, and `useSessionPersistence` takes it too.
  
  ```ts
  // Before
  useAutosave(write, { delayMs: 1000 });
  
  // After
  useAutosave(write, { debounceMs: 1000 });
  useSessionPersistence(scene, { sceneKey, historyKey, debounceMs: 1000 });
  ```
  
  <!-- entry: breaking api -->
- 5f6ebf3: `serializeReplacer`, `reviveTypedArrays` and `snapshotValue` are removed: core's snapshot codec replaces them.
  
  This is a breaking change. Encode with core's `encodeSnapshot` or `stringifySnapshot` and decode with `decodeSnapshot` or `parseSnapshot`; saved data reads as before.
  
  ```ts
  // before
  JSON.stringify(scene.toJSON(), serializeReplacer);
  reviveTypedArrays(JSON.parse(text));
  snapshotValue(scene.toJSON());
  // after
  stringifySnapshot(scene.toJSON());
  parseSnapshot(text);
  encodeSnapshot(scene.toJSON());
  ```
  
  <!-- entry: breaking api -->
- dfb37e7: `usePages`, `usePageSettle` and `usePageFit` take `padding` (and `usePageSettle` its `paging`) in an options bag, not positionally.
  
  ```ts
  // before
  usePages(scene, view, dims, setView, 32, { paging: 'single' });
  usePageSettle(pages, view, dims, setView, 'single', 32);
  usePageFit(dims, fitKey, page, setView, 32);
  // after
  usePages(scene, view, dims, setView, { paging: 'single', padding: 32 });
  usePageSettle(pages, view, dims, setView, { paging: 'single', padding: 32 });
  usePageFit(dims, fitKey, page, setView, { padding: 32 });
  ```
  
  `PageSettleOptions` and `PageFitOptions` are exported beside `UsePagesOptions`.
  
  <!-- entry: breaking api -->
- 5eca6e5: `EditorPrefsDialog` asks to close through `onOpenChange`, like `PrefsDialog` and every other modal in the kit; `onClose` is gone.
  
  ```tsx
  // before
  <EditorPrefsDialog store={store} open={open} onClose={() => setOpen(false)} />
  // after
  <EditorPrefsDialog store={store} open={open} onOpenChange={setOpen} />
  ```
  
  <!-- entry: breaking api -->
- 22f07ca: The editor's preferences exports say `Prefs`: `EDITOR_PREFS_KEY` and `useOpenPrefs`.
  
  They were `EDITOR_PREFERENCES_KEY` and `useOpenPreferences`; `Prefs` is the kit's spelling everywhere else.
  
  ```ts
  // before
  useCommand(EDITOR_ACTIONS.preferences, label, open, { keys: EDITOR_PREFERENCES_KEY });
  const openPrefs = useOpenPreferences();
  // after
  useCommand(EDITOR_ACTIONS.preferences, label, open, { keys: EDITOR_PREFS_KEY });
  const openPrefs = useOpenPrefs();
  ```
  
  <!-- entry: breaking api -->
- 5f6ebf3: `useSessionPersistence` restores an undo stack only onto the scene it was saved beside, and drops its `pages` option.
  
  This is a breaking change. The stack is saved paired with the scene (core's `encodeSceneDocument`) and restored through `restorePairedHistory`, so one beside a scene that loaded otherwise, rebuilt, migrated by the app, unreadable or replaced, is dropped; `pages` only decided that, and goes. A stack saved before this release is unpaired and is dropped once. `loadHistory` returns the stored value as saved.
  
  ```ts
  // before
  useSessionPersistence(scene, { sceneKey, historyKey, pages });
  // after
  useSessionPersistence(scene, { sceneKey, historyKey });
  ```
  
  <!-- entry: breaking api behavior data -->
- 793249b: A session entry is a value, not JSON text: `readStored` hands its reader the value, and `useAutosave` and `writeSession` store values.
  
  Entries already in `localStorage` read as before. A snapshot holding typed arrays is written through core's `encodeSnapshot` and read back with `decodeSnapshot`. `writeSession` takes the entries first and `records` last, and resolves its answer; `onSaved` is called once a save's entries have landed or failed.
  
  ```ts
  // before
  readStored('myapp:doc', (raw) => parseDoc(JSON.parse(raw)), () => EMPTY);
  useAutosave(() => ({ primary: ['myapp:scene', JSON.stringify(scene.toJSON(), serializeReplacer)] }));
  const ok = writeSession(localStorage, primary, dependents);
  // after
  readStored('myapp:doc', parseDoc, () => EMPTY);
  useAutosave(() => ({ primary: ['myapp:scene', encodeSnapshot(scene.toJSON())] }));
  const ok = await writeSession(primary, dependents);
  ```
  
  <!-- entry: breaking api -->
- 5f6ebf3: `nodeSpecsFromSnapshot` and `docFromSnapshot` read a decoded snapshot, and decode nothing themselves.
  
  This is a breaking change. `nodeSpecsFromSnapshot`'s third argument is that migration, none by default. Decode a stored value with core's `decodeSnapshot` before reading it; a migration no longer decodes typed arrays itself.
  
  ```ts
  // before
  nodeSpecsFromSnapshot(JSON.parse(text), registry, (data) => upgrade(reviveTypedArrays(data)));
  // after
  nodeSpecsFromSnapshot(parseSnapshot(text), registry, upgrade);
  ```
  
  <!-- entry: breaking api -->
- fd2cbc8: `@weasel-js/diagram`, `plot`, `labkit`, `svg` and `editor` need `@weasel-js/text-tools` installed beside them.
  
  This is breaking: add `@weasel-js/text-tools` to an app using any of them. Diagram and plot canvases turn on `textTools.text` themselves, so their labels paint and edit as before; labkit's annotation layer mounts text-tools' text tool.
  
  <!-- entry: breaking -->
- 0362193: Bindings and triggers of the plugin packages' actions that read params are checked against their `ActionParamSchema` entries.
  
  Each package merges its entries into routing's schema from its own `actionParamSchema.ts`: the diagram's label, waypoint, lane, container-title, off-page, rename-group, and sequence actions; `hud.press`, `hud.release`, `hud.doubleClick`, `hud.contextMenu`, `hud.longPress`, and `hud.wheel`; `loupe.aim` and `loupe.magnify`; `minimap.center` and `minimap.zoom`; `bone.pick`, `weight.paint`, and `weight.click`; `lab.zoom`, `camera.tap`, and `loupe.follow`; `loupe.compare.with` and `loupe.compare.dpr`; and `camera.dolly`. New exported types: diagram's `DrawMessageParams` and `WrapFragmentParams`, `HudPointParams`, `HudWheelParams`, `LoupeAimParams`, `MinimapZoomParams`, `WeightBrushParams`, `LabZoomParams`, `DollyParams`, guides' `DistanceReadoutParams`, and forge's `ForgeCompareParams` and `ForgeComparison` from `@weasel-js/forge/shell`.
  
  This is breaking for code that passes one of these ids params its entry does not declare: that is now a type error. `useDocClipboard`'s `commands.paste.keys` takes `clipboard.paste`'s params. The diagram's `*ScratchOf` readers take the hit as `unknown`.
  
  <!-- entry: breaking api -->

### Minor Changes

- df2ae04: `FileRun`, the callback `useNewCommand`, `useOpenCommand`, and `useSaveCommand` take, is exported from `@weasel-js/editor`.
  
  <!-- entry: rank=-1 api -->
- 793249b: An editor's session can be kept in IndexedDB, or any `RecordCache`, through the `records` option of its session hooks and readers.
  
  `useSessionPersistence`, `useAutosave`, `readStored`, and `writeSession` take it. Open the records before the scene is made; their reads are synchronous once open, and the keys become the records' names. Without `records`, the hooks keep the session in `localStorage` as before.
  
  ```tsx
  const records = await openRecords({ storage: indexedDbAdapter, prefix: 'myapp:' });
  const saved = readStored('scene', readScene, () => EMPTY, records);
  // …
  useSessionPersistence(scene, { sceneKey: 'scene', historyKey: 'history', records });
  ```
  
  <!-- entry: rank=10 new api -->
- 25d2f45: Every canvas in an `EditorShell` registers with the devtools hook in a development build, and `devtools={false}` turns that off.
  
  `devtools={true}` keeps it in a production build too. Left out, a `devtools` entry provided above the shell decides, so `devtoolsOff` from `@weasel-js/devtools/mount` turns it off for every shell under it. A production bundle never loads the hook unless asked.
  
  <!-- entry: rank=8 new api behavior -->
- 2fc1c00: `<EditorShell>` opens a keyboard shortcut sheet on Shift+/, listing the tools a workspace publishes with `usePublishEditorTools`.
  
  `shortcuts` sets how its `shortcuts.show` command registers, as `preferences` does for Preferences, and `shortcuts={null}` registers none. `<PublishEditorTools>` publishes from a host that holds its tools above the shell.
  
  <!-- entry: rank=5 api new -->
- 371b695: `pageGridSchema` is a page grid's settings as a prefs group, and `usePageGrid` takes its values.
  
  Mount it in an app's schema and spread the group's values in beside the page and its fill:
  
  ```tsx
  const [grid] = usePrefGroup(store, 'view.grid');
  const { layer, source } = usePageGrid({ ...grid, page, background });
  ```
  
  `PageGridOptions` now extends `PageGridSettings`, the group's values.
  
  <!-- entry: rank=5 new api -->
- aedb49f: `useSessionPersistence` reports how each saved undo stack restored, and can keep one naming ops this build cannot replay.
  
  `onHistoryRestore` hears each saved stack it reads, with `restorePairedHistory`'s answer: `{ status: 'restored', report }`, or `'unpaired'`, `'mismatched'` or `'stale'` for a stack it dropped. `historyRecovery: 'best-effort'` keeps a stack naming ops this build cannot replay; under the default, `'strict'`, that stack is dropped and `onHistoryRestore` receives `{ status: 'failed', error }`.
  
  <!-- entry: new api -->
- 0524f29: `useSessionPersistence` stamps each saved scene with when it was saved, read back with the new `savedAtOf(value)`.
  
  The stamp is a `savedAt` field, in milliseconds since the epoch, on the scene entry; `savedAtOf` returns `undefined` for an entry saved before it. An app keeping a session in two storages can open the newer copy by it.
  
  <!-- entry: api data -->
- a6bf615: `writeSession` removes the document when given `undefined` for its value.
  
  It is held to the same rule as a write: a document `readStored` could not read is not removed until its copy aside has landed.
  
  ```ts
  await writeSession(['myapp:draft', undefined]);
  ```
  
  <!-- entry: api -->

### Patch Changes

- 5ad99b6: `adoptSnapshotPages` refuses a `core:pages` value whose layout has a `direction`, `gap`, `align` or `origin` the page layout cannot read.
  
  <!-- entry: fix data -->
- 9acba9b: `useAutosave` and `useSessionPersistence` pass the error to `onSaved(false, error)` when the save's `write` throws.
  
  With no `onSaved`, the error is logged with `console.error`.
  
  <!-- entry: fix -->
- f5058e3: The clipboard ops and wire format move from `@weasel-js/core` to `@weasel-js/editing`, retiring `@weasel-js/core/clipboard`.
  
  This is breaking. These are editing's now, under the same names: `useClipboard`, `useClipboardOps`, `WEASEL_CLIPBOARD_MIME`, `WEASEL_CLIPBOARD_MIME_WEB`, `buildWeaselClipboardText`, `sniffWeaselClipboardText`, `parseWeaselClipboardText`, `embedWeaselMetadataInSvg`, `extractWeaselClipboardFromSvg`, and the types `ClipboardFlavors`, `PastedItems`, `UseClipboardOptions`, `UseClipboardOpsOptions` and `UseClipboardOpsReturn`. `materializePaste` is no longer exported. The clipboard contract types (`ClipboardSnapshot`, `PasteCtx`, `PasteOmission`, `ClipboardDep`) stay in core. `@weasel-js/editor` now depends on `@weasel-js/editing`, whose `useClipboard` its `useDocClipboard` runs on.
  
  ```ts
  // before
  import { useClipboardOps } from '@weasel-js/core';
  import { buildWeaselClipboardText } from '@weasel-js/core/clipboard';
  // after
  import { buildWeaselClipboardText, useClipboardOps } from '@weasel-js/editing';
  ```
  
  <!-- entry: rank=10 breaking api -->
- 471581b: Packages no longer install weasel siblings their code never uses.
  
  `@weasel-js/editor` stops asking for `@weasel-js/geom` as a peer and takes `@weasel-js/editing` only as one; `@weasel-js/prefs-editor` drops `@weasel-js/paint-kinds`, `@weasel-js/ui` drops `@weasel-js/storage`, `@weasel-js/icons-plugin` drops `@weasel-js/icons`, `@weasel-js/labkit` drops `@weasel-js/animator`, `@weasel-js/measure` drops `@weasel-js/theme`, `@weasel-js/rig` drops `@weasel-js/history` and `@weasel-js/renderer`, `@weasel-js/text-tools` drops `@weasel-js/icons` and `@weasel-js/prefs-schema`, and `@weasel-js/ui-canvas` drops `@weasel-js/history`.
  
  <!-- entry: internal -->
- d14878a: Saves queued behind one whose `onSaved` threw still run, in `useAutosave` and `useSessionPersistence`.
  
  The throw is logged with `console.error`.
  
  <!-- entry: fix -->
- 7575dd0: `useAutosave` and `useSessionPersistence` pass the error to `onSaved(false, error)` when the save itself throws.
  
  With no `onSaved`, the error is logged with `console.error`, as for a throwing `write`.
  
  <!-- entry: fix -->
- a445bb7: The default keys of the file commands, the document clipboard, and Preferences declare binding ids, `<command id>.key`.
  
  A binding override can now name them. `EDITOR_PREFS_KEY` and `SNAPPING_KEY` are typed as the `KeySpec`s they are.
  
  <!-- entry: fix -->
- 99a7451: `editorMenuBar` keeps a menu keyed `__proto__` as its own entry, and builds one keyed `constructor` only from its own contribution.
  
  <!-- entry: fix -->
- 06704ae: `usePageFit`'s returned refit keeps its identity when `padding` changes, and fits with the latest padding.
  
  <!-- entry: fix -->
- a7140fc: The page run a snapshot load adopts takes its id through registry's `freshId` rather than a loop of its own.
  
  <!-- entry: internal -->
- 25da931: `usePageSettle` waits for a pointer pressed before `'single'` paging turned on, instead of settling the view under it.
  
  <!-- entry: fix -->
- a5c1865: `@weasel-js/editor` takes `@weasel-js/editing` as a peer dependency: install both.
  
  `EditorShell`'s shortcut sheet groups tools by editing's `KIT_TOOL_GROUPS`.
  
  <!-- entry: internal -->
- 23c35b1: `EditorPrefsDialog` splits a preference that has `scopes` into its members, each written at its own selection.
  
  <!-- entry: fix -->
- 1f7db87: The shell's shortcut sheet keeps listing a mounted canvas's tools when another canvas that published tools unmounts.
  
  <!-- entry: fix -->
- effc300: `nodeSpecsFromSnapshot` takes a reviver that migrates older saved data, typed `(data: TData) => TData`, with no cast.
  
  ```ts
  const migrate = ({ color, ...rest }: Saved): Saved => (color === undefined ? rest : { ...rest, fill: color });
  const specs = nodeSpecsFromSnapshot(json, registry, migrate);
  ```
  
  <!-- entry: fix -->
- 601db3b: `pageGridSchema` shows Grid density only while the grid shows or snaps, and Accent every only while the grid shows.
  
  <!-- entry: fix -->
- 1f324fb: Single-page paging settles the view after a press whose release the page never saw, such as one let go over another window.
  
  <!-- entry: fix -->
- 65dd538: `useSessionPersistence` reports a `loadHistory` that throws to `onHistoryRestore` as `{ status: 'failed', error }`.
  
  With no `onHistoryRestore`, the error is logged with `console.error`.
  
  <!-- entry: fix -->
- 4f23eaa: `downloadBlob` and `pickFile` are exported from `@weasel-js/storage`, so code that does not take the editor can save and open files.
  
  `@weasel-js/editor` still exports both, as the same functions.
  
  <!-- entry: api -->
- 959f804: A double-click on text opens it through the `enterTextEditAt` action, so a host's `useSceneTextEdit` needs no `onDoubleClick` handler.
  
  `useSceneTextEdit` no longer returns `onDoubleClick`, and `TextEditDoubleClick` is gone. The `textEdit` feature (part of `edit`) binds the double-click to `enterTextEditAt`, which opens what the editor's new `textAt(world)` names and declines where the double-click names a group, as path edit does. A canvas inside a `useSceneTextEdit` container answers the `textEdit` dep with that editor, so `TextEditDepPublisher` is only needed for a container that does not hold the canvas. A `TextEditDep` you write yourself now has `textAt`.
  
  ```tsx
  // Before
  const edit = useSceneTextEdit(scene, host);
  <div ref={setHost} onDoubleClick={edit.onDoubleClick}>
    <SceneCanvas scene={scene} features={['edit']}>
      <TextEditDepPublisher edit={edit} />
    </SceneCanvas>
  </div>
  
  // After
  const edit = useSceneTextEdit(scene, host);
  <div ref={setHost}>
    <SceneCanvas scene={scene} features={['edit']} />
  </div>
  ```
  
  <!-- entry: rank=10 breaking api -->
- 1f71e57: `@weasel-js/ui`'s and `@weasel-js/editor`'s types resolve on a strict install.
  
  Their `.d.ts` name `PrefGroup` and `PrefBoolean` from `@weasel-js/prefs-schema`, which each now declares beside `@weasel-js/prefs`.
  
  <!-- entry: fix -->
- a6bf615: A document `readStored` could not read is no longer saved over or removed until its copy under `<key>:unreadable` has landed.
  
  Until then `writeSession` and `useAutosave` try the copy again on each save and answer false, so `onSaved` reports the failure; once it lands, saves go through as usual.
  
  <!-- entry: fix -->
- Updated dependencies [c91a03c]
- Updated dependencies [edb78f4]
- Updated dependencies [b18bc9c]
- Updated dependencies [a1eab73]
- Updated dependencies [037e5da]
- Updated dependencies [5099ca3]
- Updated dependencies [e5f53c6]
- Updated dependencies [74e52e2]
- Updated dependencies [617fd6c]
- Updated dependencies [03c5f2f]
- Updated dependencies [fe3c2df]
- Updated dependencies [2748abb]
- Updated dependencies [1ab8057]
- Updated dependencies [8d7296a]
- Updated dependencies [33d9b95]
- Updated dependencies [21eb68a]
- Updated dependencies [2a3a075]
- Updated dependencies [5ad99b6]
- Updated dependencies [4204bdb]
- Updated dependencies [8b96ffe]
- Updated dependencies [66890e4]
- Updated dependencies [ea90cbf]
- Updated dependencies [933408d]
- Updated dependencies [060b8c7]
- Updated dependencies [23ea9ba]
- Updated dependencies [82b9b17]
- Updated dependencies [5024537]
- Updated dependencies [9c88969]
- Updated dependencies [f1bc116]
- Updated dependencies [cc2929d]
- Updated dependencies [66fcc99]
- Updated dependencies [effe879]
- Updated dependencies [db9988a]
- Updated dependencies [19ed3de]
- Updated dependencies [223c71b]
- Updated dependencies [7f25db9]
- Updated dependencies [c3a8dea]
- Updated dependencies [c7e5656]
- Updated dependencies [2c2ab71]
- Updated dependencies [e6b28fe]
- Updated dependencies [5ea9c3c]
- Updated dependencies [c21157b]
- Updated dependencies [c21157b]
- Updated dependencies [d8c99f9]
- Updated dependencies [ae32194]
- Updated dependencies [0f72977]
- Updated dependencies [ca40330]
- Updated dependencies [985c561]
- Updated dependencies [e0d4dec]
- Updated dependencies [98620a3]
- Updated dependencies [816aa33]
- Updated dependencies [74c6bc8]
- Updated dependencies [198cf5b]
- Updated dependencies [fd6c46d]
- Updated dependencies [0cb1c7e]
- Updated dependencies [aa431c4]
- Updated dependencies [c2b9114]
- Updated dependencies [69e5b0e]
- Updated dependencies [13a7faa]
- Updated dependencies [8cb429e]
- Updated dependencies [f0f4cac]
- Updated dependencies [5f58c1b]
- Updated dependencies [e43b357]
- Updated dependencies [b772a09]
- Updated dependencies [ecdc839]
- Updated dependencies [f73a532]
- Updated dependencies [b0ab1de]
- Updated dependencies [6c7e360]
- Updated dependencies [4e2b4b7]
- Updated dependencies [3abc3d2]
- Updated dependencies [6304d44]
- Updated dependencies [a6c93fc]
- Updated dependencies [1799fd9]
- Updated dependencies [cacb8d2]
- Updated dependencies [1e4bd39]
- Updated dependencies [593ba1c]
- Updated dependencies [0df21c4]
- Updated dependencies [8b65225]
- Updated dependencies [bce1511]
- Updated dependencies [915e939]
- Updated dependencies [0c38680]
- Updated dependencies [8dd81d1]
- Updated dependencies [9f518e3]
- Updated dependencies [efac2ff]
- Updated dependencies [2c26379]
- Updated dependencies [49b00d3]
- Updated dependencies [7e5e131]
- Updated dependencies [e332c18]
- Updated dependencies [89a65b2]
- Updated dependencies [4456926]
- Updated dependencies [2f21db6]
- Updated dependencies [4217daa]
- Updated dependencies [5e372b0]
- Updated dependencies [d8c99f9]
- Updated dependencies [d4b500f]
- Updated dependencies [25561f0]
- Updated dependencies [7e52e88]
- Updated dependencies [d5ea1cd]
- Updated dependencies [c48cefb]
- Updated dependencies [e70e43a]
- Updated dependencies [a430d71]
- Updated dependencies [0c38680]
- Updated dependencies [b8efc4e]
- Updated dependencies [2fa47df]
- Updated dependencies [4de2fc3]
- Updated dependencies [d864c82]
- Updated dependencies [5fd0ac0]
- Updated dependencies [aabd7d4]
- Updated dependencies [2fa4792]
- Updated dependencies [cc83c57]
- Updated dependencies [b84b121]
- Updated dependencies [130b86c]
- Updated dependencies [f0fc3c3]
- Updated dependencies [02e57ce]
- Updated dependencies [e377035]
- Updated dependencies [ed01168]
- Updated dependencies [79eb445]
- Updated dependencies [bb82f7b]
- Updated dependencies [f588072]
- Updated dependencies [3ce9841]
- Updated dependencies [48e3802]
- Updated dependencies [a9e84f6]
- Updated dependencies [44bae89]
- Updated dependencies [a2b7b33]
- Updated dependencies [29a55fc]
- Updated dependencies [4806d08]
- Updated dependencies [6251e13]
- Updated dependencies [f1ce360]
- Updated dependencies [7dcd54e]
- Updated dependencies [e72e26a]
- Updated dependencies [97fecd3]
- Updated dependencies [0cc6896]
- Updated dependencies [3d38747]
- Updated dependencies [1a791c7]
- Updated dependencies [47fb0e0]
- Updated dependencies [643c699]
- Updated dependencies [ca5bcb0]
- Updated dependencies [6da5a3b]
- Updated dependencies [e468edc]
- Updated dependencies [a7dab9f]
- Updated dependencies [63fbbdf]
- Updated dependencies [6355d18]
- Updated dependencies [3f23bc8]
- Updated dependencies [691b592]
- Updated dependencies [ca40330]
- Updated dependencies [3f8af47]
- Updated dependencies [b508e1a]
- Updated dependencies [458aa6a]
- Updated dependencies [0ab1ba7]
- Updated dependencies [1068133]
- Updated dependencies [037e5da]
- Updated dependencies [42f4282]
- Updated dependencies [2abe42c]
- Updated dependencies [a2e83e7]
- Updated dependencies [36757b1]
- Updated dependencies [f20931c]
- Updated dependencies [44848fe]
- Updated dependencies [9a3bf41]
- Updated dependencies [3bf5d6c]
- Updated dependencies [21d7e6b]
- Updated dependencies [ff7314a]
- Updated dependencies [315f5ee]
- Updated dependencies [97f1f86]
- Updated dependencies [1566d81]
- Updated dependencies [6bbc0e5]
- Updated dependencies [33c1e37]
- Updated dependencies [62f5560]
- Updated dependencies [fd2cbc8]
- Updated dependencies [bca1b16]
- Updated dependencies [8305acd]
- Updated dependencies [063b00c]
- Updated dependencies [174d6ef]
- Updated dependencies [bfc8672]
- Updated dependencies [8dd351a]
- Updated dependencies [8a1c306]
- Updated dependencies [c4cb671]
- Updated dependencies [840a01b]
- Updated dependencies [f172abc]
- Updated dependencies [4f264d0]
- Updated dependencies [84028cb]
- Updated dependencies [afdace8]
- Updated dependencies [ac4d9b5]
- Updated dependencies [e8df1fc]
- Updated dependencies [39fd347]
- Updated dependencies [f5058e3]
- Updated dependencies [7f1cc2d]
- Updated dependencies [cf2a57b]
- Updated dependencies [7a5e072]
- Updated dependencies [bb5880a]
- Updated dependencies [f1e15f8]
- Updated dependencies [a63b723]
- Updated dependencies [5d04502]
- Updated dependencies [0c07b8d]
- Updated dependencies [2140bf1]
- Updated dependencies [50cef3a]
- Updated dependencies [f1aa255]
- Updated dependencies [76a1854]
- Updated dependencies [fcc5602]
- Updated dependencies [fbaeee8]
- Updated dependencies [6dfe3db]
- Updated dependencies [471aac9]
- Updated dependencies [bd216e3]
- Updated dependencies [9787af2]
- Updated dependencies [775d05c]
- Updated dependencies [55f12df]
- Updated dependencies [dcdfa16]
- Updated dependencies [434b840]
- Updated dependencies [aaa6a30]
- Updated dependencies [1857565]
- Updated dependencies [41c0399]
- Updated dependencies [269320b]
- Updated dependencies [8a9e76d]
- Updated dependencies [2945e8c]
- Updated dependencies [b7d2f0a]
- Updated dependencies [c3935f7]
- Updated dependencies [fcc31eb]
- Updated dependencies [8bc6d64]
- Updated dependencies [c3da788]
- Updated dependencies [9621063]
- Updated dependencies [869d865]
- Updated dependencies [42aab0c]
- Updated dependencies [d3d65f1]
- Updated dependencies [3a00602]
- Updated dependencies [ab7f613]
- Updated dependencies [95ddf7a]
- Updated dependencies [1d7b94d]
- Updated dependencies [daa7a4d]
- Updated dependencies [9f5155f]
- Updated dependencies [86e1580]
- Updated dependencies [06303a3]
- Updated dependencies [8278212]
- Updated dependencies [1b27b2f]
- Updated dependencies [2a0b5f3]
- Updated dependencies [a529c26]
- Updated dependencies [f44131a]
- Updated dependencies [394cc06]
- Updated dependencies [a4e0df7]
- Updated dependencies [bfef616]
- Updated dependencies [d0ec6bd]
- Updated dependencies [3742696]
- Updated dependencies [fd63c16]
- Updated dependencies [8c58288]
- Updated dependencies [964a242]
- Updated dependencies [7cfda30]
- Updated dependencies [93b6009]
- Updated dependencies [37baa8c]
- Updated dependencies [e8e7f2f]
- Updated dependencies [e8e7f2f]
- Updated dependencies [e8e7f2f]
- Updated dependencies [5a8ac8c]
- Updated dependencies [e8e7f2f]
- Updated dependencies [963f8fd]
- Updated dependencies [5c345b8]
- Updated dependencies [b0905a2]
- Updated dependencies [1c9986a]
- Updated dependencies [1c9986a]
- Updated dependencies [83ad38f]
- Updated dependencies [0200213]
- Updated dependencies [e8e7f2f]
- Updated dependencies [b05583a]
- Updated dependencies [77bfacf]
- Updated dependencies [f585154]
- Updated dependencies [15a05d9]
- Updated dependencies [74202d3]
- Updated dependencies [c30911d]
- Updated dependencies [c569caf]
- Updated dependencies [280f9fc]
- Updated dependencies [4844d4d]
- Updated dependencies [43fb985]
- Updated dependencies [59944c1]
- Updated dependencies [6d2bb1e]
- Updated dependencies [106749f]
- Updated dependencies [e9897c7]
- Updated dependencies [075971c]
- Updated dependencies [04cd5f3]
- Updated dependencies [2940a77]
- Updated dependencies [2ab2678]
- Updated dependencies [93a7c62]
- Updated dependencies [b05583a]
- Updated dependencies [6f94fe3]
- Updated dependencies [0a2be4b]
- Updated dependencies [5477214]
- Updated dependencies [5f6ebf3]
- Updated dependencies [b76c25e]
- Updated dependencies [5614b4e]
- Updated dependencies [e21ec2d]
- Updated dependencies [386bbfc]
- Updated dependencies [ac792e8]
- Updated dependencies [3fdbc32]
- Updated dependencies [9430cf9]
- Updated dependencies [5f6ebf3]
- Updated dependencies [95d06c3]
- Updated dependencies [3e32141]
- Updated dependencies [9231556]
- Updated dependencies [63c1844]
- Updated dependencies [fd2cbc8]
- Updated dependencies [fd2cbc8]
- Updated dependencies [b0905a2]
- Updated dependencies [a8d34ac]
- Updated dependencies [66e447b]
- Updated dependencies [e9f7adf]
- Updated dependencies [bfb8442]
- Updated dependencies [452ac07]
- Updated dependencies [4a2b3cc]
- Updated dependencies [1bd148d]
- Updated dependencies [7064286]
- Updated dependencies [e67d322]
- Updated dependencies [6316070]
- Updated dependencies [0d810a1]
- Updated dependencies [9249b26]
- Updated dependencies [d917fd4]
- Updated dependencies [37c0385]
- Updated dependencies [f2db162]
- Updated dependencies [949c317]
- Updated dependencies [797729a]
- Updated dependencies [c967b30]
- Updated dependencies [2600317]
- Updated dependencies [e377035]
- Updated dependencies [8de44b2]
- Updated dependencies [0054705]
- Updated dependencies [7b2bd39]
- Updated dependencies [a70d69d]
- Updated dependencies [678da69]
- Updated dependencies [0ac2304]
- Updated dependencies [e4fdb90]
- Updated dependencies [0a29b0e]
- Updated dependencies [72dc525]
- Updated dependencies [23fc186]
- Updated dependencies [fcc5602]
- Updated dependencies [67cb291]
- Updated dependencies [132d87e]
- Updated dependencies [7edea08]
- Updated dependencies [e073f0a]
- Updated dependencies [dab2282]
- Updated dependencies [2dfd1a2]
- Updated dependencies [ad2ec48]
- Updated dependencies [b7045cd]
- Updated dependencies [dd418ef]
- Updated dependencies [fa7009e]
- Updated dependencies [5643a3b]
- Updated dependencies [a2df698]
- Updated dependencies [794862e]
- Updated dependencies [45dec84]
- Updated dependencies [037e5da]
- Updated dependencies [d7ac369]
- Updated dependencies [0c979ed]
- Updated dependencies [382bf20]
- Updated dependencies [18dacec]
- Updated dependencies [d315cbd]
- Updated dependencies [4a84861]
- Updated dependencies [5cf9f61]
- Updated dependencies [5db5049]
- Updated dependencies [656a653]
- Updated dependencies [42d49af]
- Updated dependencies [94c8e4c]
- Updated dependencies [4a93e4b]
- Updated dependencies [eca2b03]
- Updated dependencies [fcfefd4]
- Updated dependencies [7252e96]
- Updated dependencies [f4ac9bc]
- Updated dependencies [81b7535]
- Updated dependencies [bfc26b4]
- Updated dependencies [deeab94]
- Updated dependencies [2503372]
- Updated dependencies [bde7b24]
- Updated dependencies [0cfdb6c]
- Updated dependencies [929a2d2]
- Updated dependencies [03c5f2f]
- Updated dependencies [8764186]
- Updated dependencies [f3c2f12]
- Updated dependencies [81f2080]
- Updated dependencies [84a4212]
- Updated dependencies [7542fc9]
- Updated dependencies [319879e]
- Updated dependencies [8d7296a]
- Updated dependencies [398b575]
- Updated dependencies [ad433e9]
- Updated dependencies [0983672]
- Updated dependencies [e6ec996]
- Updated dependencies [c9d0943]
- Updated dependencies [faa97fb]
- Updated dependencies [0315cdb]
- Updated dependencies [e226e23]
- Updated dependencies [6b0d6b4]
- Updated dependencies [1aa6f1e]
- Updated dependencies [0e26f75]
- Updated dependencies [aac74be]
- Updated dependencies [4f18b18]
- Updated dependencies [f1841ee]
- Updated dependencies [2ccc0cb]
- Updated dependencies [da249f5]
- Updated dependencies [ef1da0d]
- Updated dependencies [83e66da]
- Updated dependencies [7158bf0]
- Updated dependencies [3302c2a]
- Updated dependencies [9a3bf41]
- Updated dependencies [9a3bf41]
- Updated dependencies [ecf174b]
- Updated dependencies [9c190a5]
- Updated dependencies [0315cdb]
- Updated dependencies [757101c]
- Updated dependencies [efd57b0]
- Updated dependencies [e5a4400]
- Updated dependencies [5dec30c]
- Updated dependencies [a3a9fd1]
- Updated dependencies [31d9b43]
- Updated dependencies [1c5b804]
- Updated dependencies [fee4957]
- Updated dependencies [3822811]
- Updated dependencies [09690d7]
- Updated dependencies [5dba94f]
- Updated dependencies [fd75c0d]
- Updated dependencies [88d8de3]
- Updated dependencies [8fd3d6d]
- Updated dependencies [7ea1a9c]
- Updated dependencies [b894afe]
- Updated dependencies [0a80ef0]
- Updated dependencies [0a80ef0]
- Updated dependencies [0c2f119]
- Updated dependencies [d3d3973]
- Updated dependencies [1b0a5fc]
- Updated dependencies [0fa35fd]
- Updated dependencies [0e26f75]
- Updated dependencies [1bc90d8]
- Updated dependencies [6abb715]
- Updated dependencies [6f282d5]
- Updated dependencies [22c6086]
- Updated dependencies [e4a72b6]
- Updated dependencies [2cd52fc]
- Updated dependencies [efe82c4]
- Updated dependencies [7608cf2]
- Updated dependencies [037e5da]
- Updated dependencies [e0b7acb]
- Updated dependencies [df9dba4]
- Updated dependencies [2729716]
- Updated dependencies [fc28740]
- Updated dependencies [0150ec6]
- Updated dependencies [2f7e04a]
- Updated dependencies [a5bed98]
- Updated dependencies [9b8f83b]
- Updated dependencies [143e763]
- Updated dependencies [746912f]
- Updated dependencies [3a0b3b7]
- Updated dependencies [e000f0a]
- Updated dependencies [b667930]
- Updated dependencies [dc92ea4]
- Updated dependencies [15328d8]
- Updated dependencies [ebd0424]
- Updated dependencies [7e90922]
- Updated dependencies [cfc0732]
- Updated dependencies [3a8b706]
- Updated dependencies [471581b]
- Updated dependencies [15d434b]
- Updated dependencies [60ca157]
- Updated dependencies [15a08cc]
- Updated dependencies [5a805e9]
- Updated dependencies [81f2080]
- Updated dependencies [593893d]
- Updated dependencies [ef704a6]
- Updated dependencies [fcc5602]
- Updated dependencies [8063ea0]
- Updated dependencies [b305781]
- Updated dependencies [8c58288]
- Updated dependencies [084198c]
- Updated dependencies [b0d7740]
- Updated dependencies [df9a774]
- Updated dependencies [afed7af]
- Updated dependencies [a639e4d]
- Updated dependencies [040af35]
- Updated dependencies [51376ec]
- Updated dependencies [e7c03a3]
- Updated dependencies [62aede0]
- Updated dependencies [64fed84]
- Updated dependencies [bbbe801]
- Updated dependencies [43fb985]
- Updated dependencies [75f0443]
- Updated dependencies [f1a886d]
- Updated dependencies [c70da31]
- Updated dependencies [33ddb2e]
- Updated dependencies [964a242]
- Updated dependencies [17e237b]
- Updated dependencies [2b283ed]
- Updated dependencies [d074d01]
- Updated dependencies [1566d81]
- Updated dependencies [f37a70e]
- Updated dependencies [2755b11]
- Updated dependencies [8e1481b]
- Updated dependencies [20324de]
- Updated dependencies [49aa4d8]
- Updated dependencies [a6e8651]
- Updated dependencies [67ee776]
- Updated dependencies [dc881e4]
- Updated dependencies [f9b150c]
- Updated dependencies [95ca540]
- Updated dependencies [180ec74]
- Updated dependencies [9787bca]
- Updated dependencies [16a2eed]
- Updated dependencies [3eb3209]
- Updated dependencies [2ac34a7]
- Updated dependencies [b5c341d]
- Updated dependencies [7e60049]
- Updated dependencies [c7db707]
- Updated dependencies [d26152c]
- Updated dependencies [a3136aa]
- Updated dependencies [27eb7f9]
- Updated dependencies [754e0c6]
- Updated dependencies [aedb49f]
- Updated dependencies [644baad]
- Updated dependencies [1d7b94d]
- Updated dependencies [8553648]
- Updated dependencies [ebcef7d]
- Updated dependencies [99b2391]
- Updated dependencies [1d7b94d]
- Updated dependencies [be2d6ee]
- Updated dependencies [65c7201]
- Updated dependencies [28e4e71]
- Updated dependencies [10f6906]
- Updated dependencies [9b5de64]
- Updated dependencies [6bb95ac]
- Updated dependencies [643b01f]
- Updated dependencies [992b75b]
- Updated dependencies [bc6e8ab]
- Updated dependencies [e5e59a3]
- Updated dependencies [cc21a03]
- Updated dependencies [826b7f7]
- Updated dependencies [6619ff1]
- Updated dependencies [3c212ef]
- Updated dependencies [23d94db]
- Updated dependencies [ac8e807]
- Updated dependencies [fb47e9b]
- Updated dependencies [8c17e91]
- Updated dependencies [50900c3]
- Updated dependencies [7b7b3b2]
- Updated dependencies [dee9060]
- Updated dependencies [c0225d4]
- Updated dependencies [e921294]
- Updated dependencies [cc5b0c3]
- Updated dependencies [52ba759]
- Updated dependencies [08f80b9]
- Updated dependencies [922195e]
- Updated dependencies [2931163]
- Updated dependencies [fab8e30]
- Updated dependencies [b1cfa76]
- Updated dependencies [4be1a3f]
- Updated dependencies [c90d8d7]
- Updated dependencies [20502eb]
- Updated dependencies [2ddb6a5]
- Updated dependencies [4e54b4e]
- Updated dependencies [1bf22f4]
- Updated dependencies [f6162e8]
- Updated dependencies [cdadc6c]
- Updated dependencies [f889447]
- Updated dependencies [4949266]
- Updated dependencies [f54c013]
- Updated dependencies [27f0928]
- Updated dependencies [11c9e5f]
- Updated dependencies [241446a]
- Updated dependencies [e0a11e4]
- Updated dependencies [da7dd2e]
- Updated dependencies [02900a7]
- Updated dependencies [79d4797]
- Updated dependencies [a947127]
- Updated dependencies [cf24657]
- Updated dependencies [1d5a968]
- Updated dependencies [5bd62a1]
- Updated dependencies [95bd84c]
- Updated dependencies [b7e560b]
- Updated dependencies [174d6ef]
- Updated dependencies [cfbecdb]
- Updated dependencies [9c2b3d6]
- Updated dependencies [03f84f2]
- Updated dependencies [8457029]
- Updated dependencies [22eec46]
- Updated dependencies [8fd3d6d]
- Updated dependencies [5b84825]
- Updated dependencies [516bc59]
- Updated dependencies [2338cee]
- Updated dependencies [56ae12f]
- Updated dependencies [034f292]
- Updated dependencies [1d207f7]
- Updated dependencies [57ceaee]
- Updated dependencies [0c68992]
- Updated dependencies [614d268]
- Updated dependencies [76b506f]
- Updated dependencies [72497ce]
- Updated dependencies [7221d69]
- Updated dependencies [425b3bd]
- Updated dependencies [f60eb1d]
- Updated dependencies [93f0494]
- Updated dependencies [d7d80af]
- Updated dependencies [8a9d9b0]
- Updated dependencies [f60f91a]
- Updated dependencies [dee89e1]
- Updated dependencies [dbb1aee]
- Updated dependencies [eacd023]
- Updated dependencies [0b0b1ef]
- Updated dependencies [0b0b1ef]
- Updated dependencies [cf7a5e5]
- Updated dependencies [d6f1b4d]
- Updated dependencies [5170c0d]
- Updated dependencies [f245e23]
- Updated dependencies [129e595]
- Updated dependencies [ed0fff4]
- Updated dependencies [4bb7f17]
- Updated dependencies [8764186]
- Updated dependencies [9606e24]
- Updated dependencies [a7dab9f]
- Updated dependencies [22dc8ed]
- Updated dependencies [8dd0eec]
- Updated dependencies [dc0b012]
- Updated dependencies [3d0cb10]
- Updated dependencies [0d7681b]
- Updated dependencies [d5be3f8]
- Updated dependencies [416c1c7]
- Updated dependencies [5d645b4]
- Updated dependencies [13e50e7]
- Updated dependencies [d4793c8]
- Updated dependencies [11a1cd3]
- Updated dependencies [16b03e6]
- Updated dependencies [60e2a01]
- Updated dependencies [5d645b4]
- Updated dependencies [940b851]
- Updated dependencies [15cd80b]
- Updated dependencies [5d645b4]
- Updated dependencies [815f90b]
- Updated dependencies [0f352c9]
- Updated dependencies [3a1bfaa]
- Updated dependencies [42f1123]
- Updated dependencies [00250c6]
- Updated dependencies [57a59be]
- Updated dependencies [63e7eaa]
- Updated dependencies [6943c8d]
- Updated dependencies [9b7e01c]
- Updated dependencies [aedb49f]
- Updated dependencies [441a023]
- Updated dependencies [e044df2]
- Updated dependencies [4a18e17]
- Updated dependencies [67968c3]
- Updated dependencies [27649f2]
- Updated dependencies [5117a3c]
- Updated dependencies [a0f437e]
- Updated dependencies [4b73492]
- Updated dependencies [19f8e39]
- Updated dependencies [8882b53]
- Updated dependencies [bee2796]
- Updated dependencies [0618a25]
- Updated dependencies [477eb15]
- Updated dependencies [8649268]
- Updated dependencies [b9b4c34]
- Updated dependencies [bbfb6ab]
- Updated dependencies [f89247b]
- Updated dependencies [064f0a7]
- Updated dependencies [8a24c29]
- Updated dependencies [e4f2133]
- Updated dependencies [e4f2133]
- Updated dependencies [4e9c237]
- Updated dependencies [081ca62]
- Updated dependencies [2fcd3a3]
- Updated dependencies [c4afe9e]
- Updated dependencies [ae03d3c]
- Updated dependencies [81699c7]
- Updated dependencies [2337334]
- Updated dependencies [71adee4]
- Updated dependencies [8d622d3]
- Updated dependencies [238ce99]
- Updated dependencies [0ab78c7]
- Updated dependencies [31125f5]
- Updated dependencies [a911e74]
- Updated dependencies [e85d314]
- Updated dependencies [10fbaeb]
- Updated dependencies [051b065]
- Updated dependencies [7026fca]
- Updated dependencies [f85a332]
- Updated dependencies [7cace1d]
- Updated dependencies [60b38f5]
- Updated dependencies [74261df]
- Updated dependencies [a86bd34]
- Updated dependencies [fd2cbc8]
- Updated dependencies [d059b75]
- Updated dependencies [a86bd34]
- Updated dependencies [7165e31]
- Updated dependencies [e5e7aef]
- Updated dependencies [9566a40]
- Updated dependencies [3fe1323]
- Updated dependencies [22a1496]
- Updated dependencies [c3bcbf9]
- Updated dependencies [ea0eef2]
- Updated dependencies [d061e79]
- Updated dependencies [b44408d]
- Updated dependencies [51dc6ab]
- Updated dependencies [f9ab55b]
- Updated dependencies [e70f4da]
- Updated dependencies [174d6ef]
- Updated dependencies [ccfe107]
- Updated dependencies [587332a]
- Updated dependencies [4a2b2ab]
- Updated dependencies [d315cbd]
- Updated dependencies [35257db]
- Updated dependencies [e377035]
- Updated dependencies [dc4ae6b]
- Updated dependencies [4afd436]
- Updated dependencies [1026606]
- Updated dependencies [5ddbb1f]
- Updated dependencies [14b7692]
- Updated dependencies [9121cde]
- Updated dependencies [38e795b]
- Updated dependencies [aa1dfd3]
- Updated dependencies [5c1959f]
- Updated dependencies [71d059c]
- Updated dependencies [42715a5]
- Updated dependencies [42715a5]
- Updated dependencies [79086a5]
- Updated dependencies [611540e]
- Updated dependencies [2075cbd]
- Updated dependencies [a902908]
- Updated dependencies [ac5c1bd]
- Updated dependencies [5e5d64e]
- Updated dependencies [f0e000b]
- Updated dependencies [a283eaa]
- Updated dependencies [356ce61]
- Updated dependencies [e6871f1]
- Updated dependencies [80f6d7b]
- Updated dependencies [6cc38f6]
- Updated dependencies [3823959]
- Updated dependencies [4f55a65]
- Updated dependencies [d3a4aa0]
- Updated dependencies [8e45841]
- Updated dependencies [10e17bb]
- Updated dependencies [8e6f5d2]
- Updated dependencies [800e293]
- Updated dependencies [9236a1e]
- Updated dependencies [7e5b389]
- Updated dependencies [7e5b389]
- Updated dependencies [fd2cbc8]
- Updated dependencies [1ad4f25]
- Updated dependencies [01b8a73]
- Updated dependencies [6eefcb6]
- Updated dependencies [37daa58]
- Updated dependencies [79bd6cc]
- Updated dependencies [5886c61]
- Updated dependencies [a34b3fc]
- Updated dependencies [e7d5f5a]
- Updated dependencies [a6e8651]
- Updated dependencies [7ab6268]
- Updated dependencies [554d169]
- Updated dependencies [7ab6268]
- Updated dependencies [f5cec0a]
- Updated dependencies [7ab6268]
- Updated dependencies [7ab6268]
- Updated dependencies [b564ea5]
- Updated dependencies [eff7f0f]
- Updated dependencies [ae40d94]
- Updated dependencies [fea58eb]
- Updated dependencies [0b82615]
- Updated dependencies [a0070e8]
- Updated dependencies [b584cc5]
- Updated dependencies [4d469aa]
- Updated dependencies [5886c61]
- Updated dependencies [797729a]
- Updated dependencies [b03ab76]
- Updated dependencies [1526249]
- Updated dependencies [0b29cea]
- Updated dependencies [3e89500]
- Updated dependencies [c22c9a6]
- Updated dependencies [0ac8104]
- Updated dependencies [b1e9d32]
- Updated dependencies [b96ce9a]
- Updated dependencies [de8f61d]
- Updated dependencies [a5166b0]
- Updated dependencies [8b65c38]
- Updated dependencies [7ec134d]
- Updated dependencies [34a7197]
- Updated dependencies [56784d5]
- Updated dependencies [5de44f2]
- Updated dependencies [cc7fffb]
- Updated dependencies [033c46f]
- Updated dependencies [4cc61de]
- Updated dependencies [f219a71]
- Updated dependencies [7f35ade]
- Updated dependencies [597f68d]
- Updated dependencies [812c469]
- Updated dependencies [b54ab5f]
- Updated dependencies [8c7d44b]
- Updated dependencies [b2b79f1]
- Updated dependencies [d2002e0]
- Updated dependencies [0ecff6a]
- Updated dependencies [b0905a2]
- Updated dependencies [bfc31d6]
- Updated dependencies [ce28f90]
- Updated dependencies [a23ebea]
- Updated dependencies [b10e05f]
- Updated dependencies [dfc1a37]
- Updated dependencies [7983c4e]
- Updated dependencies [f2c5695]
- Updated dependencies [9b78b1a]
- Updated dependencies [7d7219c]
- Updated dependencies [30a4077]
- Updated dependencies [8f3bce2]
- Updated dependencies [a0a2461]
- Updated dependencies [71eae88]
- Updated dependencies [13a2275]
- Updated dependencies [70b763e]
- Updated dependencies [29ca8f1]
- Updated dependencies [25511cc]
- Updated dependencies [e72e26a]
- Updated dependencies [4e12218]
- Updated dependencies [bed1c77]
- Updated dependencies [63bd5cd]
- Updated dependencies [05411e8]
- Updated dependencies [b9f3a12]
- Updated dependencies [ce75dca]
- Updated dependencies [7c560a7]
- Updated dependencies [ad0d249]
- Updated dependencies [15fc34c]
- Updated dependencies [1d48780]
- Updated dependencies [e377035]
- Updated dependencies [74edafb]
- Updated dependencies [1ba9061]
- Updated dependencies [0c1b6a6]
- Updated dependencies [b6ae714]
- Updated dependencies [a64cc29]
- Updated dependencies [e737c0f]
- Updated dependencies [69399bc]
- Updated dependencies [d59f87e]
- Updated dependencies [66e1a53]
- Updated dependencies [39c9f49]
- Updated dependencies [de344db]
- Updated dependencies [a94cb4b]
- Updated dependencies [9df0888]
- Updated dependencies [d14d16a]
- Updated dependencies [f21c0ca]
- Updated dependencies [d9c51c0]
- Updated dependencies [d19f8cc]
- Updated dependencies [717a531]
- Updated dependencies [3a50e80]
- Updated dependencies [921e20e]
- Updated dependencies [2202a32]
- Updated dependencies [f522122]
- Updated dependencies [241ebbe]
- Updated dependencies [36dc93a]
- Updated dependencies [36b25c8]
- Updated dependencies [87f3d38]
- Updated dependencies [11b0336]
- Updated dependencies [75ef9fb]
- Updated dependencies [028cc49]
- Updated dependencies [e5d2389]
- Updated dependencies [e549ad3]
- Updated dependencies [fd2cbc8]
- Updated dependencies [dc881e4]
- Updated dependencies [fb4710c]
- Updated dependencies [46440b6]
- Updated dependencies [db54baf]
- Updated dependencies [bbf58f0]
- Updated dependencies [65703dc]
- Updated dependencies [42aab0c]
- Updated dependencies [ac18636]
- Updated dependencies [5d3b9b7]
- Updated dependencies [2fa2172]
- Updated dependencies [42f88c1]
- Updated dependencies [928462b]
- Updated dependencies [928462b]
- Updated dependencies [8ff14a0]
- Updated dependencies [a0bb229]
- Updated dependencies [aedb49f]
- Updated dependencies [df97f39]
- Updated dependencies [71adee4]
- Updated dependencies [e1b53a1]
- Updated dependencies [067cf55]
- Updated dependencies [b750660]
- Updated dependencies [5b5d307]
- Updated dependencies [1b23afb]
- Updated dependencies [6661cbf]
- Updated dependencies [dc881e4]
- Updated dependencies [0a05da3]
- Updated dependencies [3e108b4]
- Updated dependencies [f4e98a4]
- Updated dependencies [b323f97]
- Updated dependencies [0bb71da]
- Updated dependencies [4bda721]
- Updated dependencies [c22c9a6]
- Updated dependencies [c76ca6e]
- Updated dependencies [744fbce]
- Updated dependencies [b29a94e]
- Updated dependencies [5531792]
- Updated dependencies [c129ce1]
- Updated dependencies [43bf365]
- Updated dependencies [c8f84f3]
- Updated dependencies [c0d43ee]
- Updated dependencies [3c498b4]
- Updated dependencies [09a0e40]
- Updated dependencies [373ac99]
- Updated dependencies [7e73f59]
- Updated dependencies [e2b10c3]
- Updated dependencies [7896da7]
- Updated dependencies [56945c8]
- Updated dependencies [a37a658]
- Updated dependencies [9d4db71]
- Updated dependencies [d73bd9f]
- Updated dependencies [4ee45ab]
- Updated dependencies [f09bd05]
- Updated dependencies [e1e7241]
- Updated dependencies [161a248]
- Updated dependencies [977164c]
- Updated dependencies [9aed377]
- Updated dependencies [e4777a9]
- Updated dependencies [e4a8c4f]
- Updated dependencies [e4a8c4f]
- Updated dependencies [a791e92]
- Updated dependencies [8ced7e2]
- Updated dependencies [5ed6215]
- Updated dependencies [9cacd4b]
- Updated dependencies [fcc5602]
- Updated dependencies [968362b]
- Updated dependencies [fd2cbc8]
- Updated dependencies [fcc5602]
- Updated dependencies [c5e5476]
- Updated dependencies [39b6012]
- Updated dependencies [1cafdce]
- Updated dependencies [86fce74]
- Updated dependencies [800e293]
- Updated dependencies [973e4ed]
- Updated dependencies [c08f873]
- Updated dependencies [8b96ffe]
- Updated dependencies [9ae8bc2]
- Updated dependencies [c6300b8]
- Updated dependencies [c8b8348]
- Updated dependencies [1e1d4c6]
- Updated dependencies [33b9074]
- Updated dependencies [ccd6f25]
- Updated dependencies [527f214]
- Updated dependencies [42169f9]
- Updated dependencies [6d2bb1e]
- Updated dependencies [c4304d4]
- Updated dependencies [edfe71a]
- Updated dependencies [1a03017]
- Updated dependencies [6a9cd12]
- Updated dependencies [be3711c]
- Updated dependencies [4f03b5d]
- Updated dependencies [c0555fb]
- Updated dependencies [094ba4d]
- Updated dependencies [7d598c5]
- Updated dependencies [6d2bb1e]
- Updated dependencies [cff801a]
- Updated dependencies [e377035]
- Updated dependencies [8d43789]
- Updated dependencies [d4c1562]
- Updated dependencies [cbb78ec]
- Updated dependencies [0ae8b0c]
- Updated dependencies [d897c83]
- Updated dependencies [3d5d715]
- Updated dependencies [8078d25]
- Updated dependencies [c428e9e]
- Updated dependencies [bf94421]
- Updated dependencies [7645aaa]
- Updated dependencies [7dd8e23]
- Updated dependencies [e265bdc]
- Updated dependencies [1fbfa96]
- Updated dependencies [9aa8036]
- Updated dependencies [76c5562]
- Updated dependencies [24bca7a]
- Updated dependencies [0c2a798]
- Updated dependencies [e377035]
- Updated dependencies [6ad7c56]
- Updated dependencies [0362193]
- Updated dependencies [1b128c4]
- Updated dependencies [768acf7]
- Updated dependencies [4bf376e]
- Updated dependencies [45e100f]
- Updated dependencies [6ab962a]
- Updated dependencies [6ab962a]
- Updated dependencies [0e01d7f]
- Updated dependencies [f8f4954]
- Updated dependencies [b1c09d3]
- Updated dependencies [fa9657c]
- Updated dependencies [f5b75cb]
- Updated dependencies [0522c76]
- Updated dependencies [b3b7fe7]
- Updated dependencies [e23047b]
- Updated dependencies [ab8626c]
- Updated dependencies [b1e00b8]
- Updated dependencies [4b3a525]
- Updated dependencies [f72c842]
- Updated dependencies [6555ec8]
- Updated dependencies [2909824]
- Updated dependencies [33f8369]
- Updated dependencies [27fdcb9]
- Updated dependencies [8f165c0]
- Updated dependencies [ea5f41b]
- Updated dependencies [6227913]
- Updated dependencies [53f5ea0]
- Updated dependencies [1dfa234]
- Updated dependencies [ae4a042]
- Updated dependencies [ae411f0]
- Updated dependencies [6e3d5ef]
- Updated dependencies [0c073ec]
- Updated dependencies [8a94042]
- Updated dependencies [9e84dfc]
- Updated dependencies [1e031a5]
- Updated dependencies [67b97e4]
- Updated dependencies [0b49560]
- Updated dependencies [7d11dc3]
- Updated dependencies [c43e329]
- Updated dependencies [f85a11b]
- Updated dependencies [ac347a7]
- Updated dependencies [7534a19]
- Updated dependencies [a3bb40a]
- Updated dependencies [313dd71]
- Updated dependencies [60ca6e8]
- Updated dependencies [97d6826]
- Updated dependencies [b7b87f4]
- Updated dependencies [a5aa92f]
- Updated dependencies [e37086f]
- Updated dependencies [a25a444]
- Updated dependencies [2d2a16e]
- Updated dependencies [87bd085]
- Updated dependencies [c4f9031]
- Updated dependencies [2ab2678]
- Updated dependencies [d09c453]
- Updated dependencies [6597fc4]
- Updated dependencies [dba7a95]
- Updated dependencies [b3ea632]
- Updated dependencies [bc04126]
- Updated dependencies [587ca97]
- Updated dependencies [15e923d]
- Updated dependencies [4c8749c]
- Updated dependencies [f05f7d3]
- Updated dependencies [08d9309]
- Updated dependencies [07c3852]
- Updated dependencies [a04eb3d]
- Updated dependencies [93d4fce]
- Updated dependencies [52def45]
- Updated dependencies [eb8fe62]
- Updated dependencies [7c44ba5]
- Updated dependencies [1eb7bcb]
- Updated dependencies [df2ae04]
- Updated dependencies [14143c7]
- Updated dependencies [a0ad214]
- Updated dependencies [607ab80]
- Updated dependencies [c240900]
- Updated dependencies [0f8da6b]
- Updated dependencies [d5bcd74]
- Updated dependencies [4a102bd]
- Updated dependencies [d4532e3]
- Updated dependencies [c80f586]
- Updated dependencies [ea67ced]
- Updated dependencies [5477214]
- Updated dependencies [cd473d6]
- Updated dependencies [d60ab9f]
- Updated dependencies [aadb086]
- Updated dependencies [8ff14a0]
- Updated dependencies [af6d87c]
- Updated dependencies [4602a76]
- Updated dependencies [f9cd1ea]
- Updated dependencies [16ce408]
- Updated dependencies [9057ecb]
- Updated dependencies [2823dca]
- Updated dependencies [1c43dbf]
- Updated dependencies [a3b1735]
- Updated dependencies [d01d5a2]
- Updated dependencies [bcc5c05]
- Updated dependencies [e11a52e]
- Updated dependencies [3744131]
- Updated dependencies [5477214]
- Updated dependencies [594d4ce]
- Updated dependencies [7e5b389]
- Updated dependencies [2e7bd80]
- Updated dependencies [6c3e486]
- Updated dependencies [e7bee92]
- Updated dependencies [7affd45]
- Updated dependencies [bef9c67]
- Updated dependencies [470d4be]
- Updated dependencies [2668893]
- Updated dependencies [5512513]
- Updated dependencies [764f27d]
- Updated dependencies [8ff14a0]
- Updated dependencies [2dfa806]
- Updated dependencies [33f8369]
- Updated dependencies [4ef636a]
- Updated dependencies [a04eb3d]
- Updated dependencies [76e3b96]
- Updated dependencies [b40160f]
- Updated dependencies [be40d3a]
- Updated dependencies [fb0e6cd]
- Updated dependencies [00ad78a]
- Updated dependencies [ca89da9]
- Updated dependencies [23c35b1]
- Updated dependencies [7e5b389]
- Updated dependencies [2f8f458]
- Updated dependencies [728e0da]
- Updated dependencies [adb9d72]
- Updated dependencies [1e9c740]
- Updated dependencies [586b6c1]
- Updated dependencies [53fb0eb]
- Updated dependencies [47fa777]
- Updated dependencies [47fa777]
- Updated dependencies [fd2cbc8]
- Updated dependencies [9566a40]
- Updated dependencies [9566a40]
- Updated dependencies [68d5da4]
- Updated dependencies [7d67497]
- Updated dependencies [5fa6d0a]
- Updated dependencies [fc665a9]
- Updated dependencies [bb8b8cb]
- Updated dependencies [5fa6d0a]
- Updated dependencies [9566a40]
- Updated dependencies [68d5da4]
- Updated dependencies [71adee4]
- Updated dependencies [a911e74]
- Updated dependencies [1d7b94d]
- Updated dependencies [fe8181e]
- Updated dependencies [13f9dd9]
- Updated dependencies [f073254]
- Updated dependencies [3b2d8c8]
- Updated dependencies [d74c803]
- Updated dependencies [9f8982e]
- Updated dependencies [a7d5e71]
- Updated dependencies [e332e09]
- Updated dependencies [ac24d7b]
- Updated dependencies [914ba92]
- Updated dependencies [c8db050]
- Updated dependencies [7fbfb0b]
- Updated dependencies [c522708]
- Updated dependencies [5cdd105]
- Updated dependencies [4d469aa]
- Updated dependencies [419b1f1]
- Updated dependencies [a3136aa]
- Updated dependencies [5b156c6]
- Updated dependencies [3f553ff]
- Updated dependencies [f976095]
- Updated dependencies [af132bc]
- Updated dependencies [86a95a6]
- Updated dependencies [a778f14]
- Updated dependencies [2146a6f]
- Updated dependencies [7eb527b]
- Updated dependencies [19d5d8a]
- Updated dependencies [42e87c0]
- Updated dependencies [9333b1a]
- Updated dependencies [fc62432]
- Updated dependencies [70e7b25]
- Updated dependencies [b9006ad]
- Updated dependencies [b9006ad]
- Updated dependencies [85d3d17]
- Updated dependencies [921d4f8]
- Updated dependencies [4a4d7c9]
- Updated dependencies [305f0ce]
- Updated dependencies [73f549e]
- Updated dependencies [73f549e]
- Updated dependencies [a13982c]
- Updated dependencies [52ee422]
- Updated dependencies [73f549e]
- Updated dependencies [4bcea5f]
- Updated dependencies [a3958dc]
- Updated dependencies [0e80f73]
- Updated dependencies [c873b55]
- Updated dependencies [aedb49f]
- Updated dependencies [406d68f]
- Updated dependencies [eb8fe62]
- Updated dependencies [e9613f8]
- Updated dependencies [f004638]
- Updated dependencies [52d9d64]
- Updated dependencies [e3c67e9]
- Updated dependencies [34090f0]
- Updated dependencies [03b9392]
- Updated dependencies [15e923d]
- Updated dependencies [5962dc2]
- Updated dependencies [5dae54d]
- Updated dependencies [0208a3b]
- Updated dependencies [bb7bb11]
- Updated dependencies [ee1de44]
- Updated dependencies [74e37d7]
- Updated dependencies [8f61f88]
- Updated dependencies [231eec5]
- Updated dependencies [0983672]
- Updated dependencies [19948e0]
- Updated dependencies [6355d18]
- Updated dependencies [fcfefd4]
- Updated dependencies [eeb7c5a]
- Updated dependencies [44848fe]
- Updated dependencies [c4d5642]
- Updated dependencies [aba9531]
- Updated dependencies [c25237f]
- Updated dependencies [b934739]
- Updated dependencies [f1e9773]
- Updated dependencies [b822d40]
- Updated dependencies [88a19c0]
- Updated dependencies [44848fe]
- Updated dependencies [f5e0446]
- Updated dependencies [f6c305d]
- Updated dependencies [00a1f20]
- Updated dependencies [6451f0c]
- Updated dependencies [f3a1232]
- Updated dependencies [d55c488]
- Updated dependencies [32356ff]
- Updated dependencies [34b8a3f]
- Updated dependencies [df73bc8]
- Updated dependencies [5c778a0]
- Updated dependencies [261488b]
- Updated dependencies [55ab2c6]
- Updated dependencies [7e1ab6c]
- Updated dependencies [162f816]
- Updated dependencies [34b8a3f]
- Updated dependencies [52e0851]
- Updated dependencies [834d2ca]
- Updated dependencies [457fbc3]
- Updated dependencies [1e80440]
- Updated dependencies [d3b20b9]
- Updated dependencies [86b5903]
- Updated dependencies [647b21c]
- Updated dependencies
- Updated dependencies [b0bc4cd]
- Updated dependencies [c23c975]
- Updated dependencies [34b8a3f]
- Updated dependencies [fd6c009]
- Updated dependencies [2076b1b]
- Updated dependencies [49b3b13]
- Updated dependencies [bd25e62]
- Updated dependencies [17d184b]
- Updated dependencies [cabffe5]
- Updated dependencies [f92300d]
- Updated dependencies [d569abf]
- Updated dependencies [76ca845]
- Updated dependencies [44ad7a3]
- Updated dependencies [44ad7a3]
- Updated dependencies [3e4c5cf]
- Updated dependencies [80b3328]
- Updated dependencies [4c90808]
- Updated dependencies [4349686]
- Updated dependencies [b14d355]
- Updated dependencies [772f457]
- Updated dependencies [82e20b7]
- Updated dependencies [597cfd7]
- Updated dependencies [845819b]
- Updated dependencies [b835405]
- Updated dependencies [660014e]
- Updated dependencies [b2e7850]
- Updated dependencies [db62edc]
- Updated dependencies [6643915]
- Updated dependencies [bf1cf7b]
- Updated dependencies [c3e773c]
- Updated dependencies [8558f40]
- Updated dependencies [fa8902c]
- Updated dependencies [96de590]
- Updated dependencies [0ac8104]
- Updated dependencies [9bbe3e4]
- Updated dependencies [0c77c8d]
- Updated dependencies [fd2cbc8]
- Updated dependencies [56f8264]
- Updated dependencies [1c6f913]
- Updated dependencies [f20931c]
- Updated dependencies [2241860]
- Updated dependencies [5d7b7b8]
- Updated dependencies [447f742]
- Updated dependencies [0fe19aa]
- Updated dependencies [5339aec]
- Updated dependencies [3a71a1a]
- Updated dependencies [a979682]
- Updated dependencies [7ab6268]
- Updated dependencies [d5e58b9]
- Updated dependencies [d8c22e6]
- Updated dependencies [f11549d]
- Updated dependencies [814994a]
- Updated dependencies [ab56471]
- Updated dependencies [86b43d1]
- Updated dependencies [eaefc65]
- Updated dependencies [8cce06e]
- Updated dependencies [16d4fab]
- Updated dependencies [edcc040]
- Updated dependencies [1ceadbf]
- Updated dependencies [a47e5ed]
- Updated dependencies [800e293]
- Updated dependencies [6829ab9]
- Updated dependencies [865ccae]
- Updated dependencies [a47e5ed]
- Updated dependencies [eb82ac9]
- Updated dependencies [795f517]
- Updated dependencies [a26f70d]
- Updated dependencies [aedb49f]
- Updated dependencies [95da921]
- Updated dependencies [6ac9c99]
- Updated dependencies [f39b469]
- Updated dependencies [e752074]
- Updated dependencies [8b73d9a]
- Updated dependencies [2557ab3]
- Updated dependencies [210f28f]
- Updated dependencies [10fbaeb]
- Updated dependencies [7513080]
- Updated dependencies [7513080]
- Updated dependencies [7513080]
- Updated dependencies [1b23afb]
- Updated dependencies [d6f3516]
- Updated dependencies [7513080]
- Updated dependencies [83a3934]
- Updated dependencies [82b59e4]
- Updated dependencies [9a64114]
- Updated dependencies [7d3bac3]
- Updated dependencies [f265eee]
- Updated dependencies [9061a88]
- Updated dependencies [62b3eee]
- Updated dependencies [3653446]
- Updated dependencies [015b597]
- Updated dependencies [3741379]
- Updated dependencies [b8e3eb3]
- Updated dependencies [5fcfce9]
- Updated dependencies [0389204]
- Updated dependencies [915d349]
- Updated dependencies [fa9c93c]
- Updated dependencies [b316348]
- Updated dependencies [25abf42]
- Updated dependencies [1e9dc58]
- Updated dependencies [a23923e]
- Updated dependencies [116f5b5]
- Updated dependencies [291e5c3]
- Updated dependencies [9217b8a]
- Updated dependencies [24a8129]
- Updated dependencies [9246f97]
- Updated dependencies [843859b]
- Updated dependencies [4816dc3]
- Updated dependencies [97cce9d]
- Updated dependencies [deda510]
- Updated dependencies [6bfce5e]
- Updated dependencies [68d5da4]
- Updated dependencies [7b82ac2]
- Updated dependencies [526965d]
- Updated dependencies [195c064]
- Updated dependencies [c017ed2]
- Updated dependencies [9f9a61a]
- Updated dependencies [b646c27]
- Updated dependencies [850db0a]
- Updated dependencies [ef3ebdd]
- Updated dependencies [0828a03]
- Updated dependencies [b92bf56]
- Updated dependencies [0828a03]
- Updated dependencies [f23829c]
- Updated dependencies [0177219]
- Updated dependencies [091bd67]
- Updated dependencies [670aeb3]
- Updated dependencies [4dcf2d3]
- Updated dependencies [66da6bf]
- Updated dependencies [d20898e]
- Updated dependencies [cdffdbb]
- Updated dependencies [2fbd36b]
- Updated dependencies [e018b7d]
- Updated dependencies [a5c1865]
- Updated dependencies [f86aaa2]
- Updated dependencies [cfebac4]
- Updated dependencies [b1cfd4e]
- Updated dependencies [dd9f482]
- Updated dependencies [033c46f]
- Updated dependencies [29135cb]
- Updated dependencies [4e54b4e]
- Updated dependencies [4e54b4e]
- Updated dependencies [4e54b4e]
- Updated dependencies [16e4b0b]
- Updated dependencies [7bc2c18]
- Updated dependencies [61a6d3e]
- Updated dependencies [b6b6026]
- Updated dependencies [5b5326b]
- Updated dependencies [ba4124a]
- Updated dependencies [5995fd1]
- Updated dependencies [475ea0d]
- Updated dependencies [49d8892]
- Updated dependencies [5e65d16]
- Updated dependencies [43caa71]
- Updated dependencies [3888b67]
- Updated dependencies [e8fe4e3]
- Updated dependencies [3c76fe8]
- Updated dependencies [63e9df9]
- Updated dependencies [f8969d7]
- Updated dependencies [138e9e3]
- Updated dependencies [bdcebe3]
- Updated dependencies [359a362]
- Updated dependencies [0983672]
- Updated dependencies [112d38a]
- Updated dependencies [e0fd385]
- Updated dependencies [aa23f5b]
- Updated dependencies [fb69a95]
- Updated dependencies [a45338c]
- Updated dependencies [fb69a95]
- Updated dependencies [3f575e2]
- Updated dependencies [c6b831f]
- Updated dependencies [4f9848f]
- Updated dependencies [fb702eb]
- Updated dependencies [ff8c1f9]
- Updated dependencies [a24da48]
- Updated dependencies [7cace1d]
- Updated dependencies [a86bd34]
- Updated dependencies [925fb74]
- Updated dependencies [32a45c4]
- Updated dependencies [adaebf1]
- Updated dependencies [cb6e47b]
- Updated dependencies [1c0046a]
- Updated dependencies [a34f319]
- Updated dependencies [cbcd314]
- Updated dependencies [9e23aea]
- Updated dependencies [dee342f]
- Updated dependencies [ef93a6d]
- Updated dependencies [4069e86]
- Updated dependencies [201717b]
- Updated dependencies [3381131]
- Updated dependencies [4f23eaa]
- Updated dependencies [817c4a0]
- Updated dependencies [f822a1d]
- Updated dependencies [99ca079]
- Updated dependencies [55af93c]
- Updated dependencies [c438a4b]
- Updated dependencies [da233f8]
- Updated dependencies [e45a847]
- Updated dependencies [ea981c8]
- Updated dependencies [3637a58]
- Updated dependencies [6bdf14d]
- Updated dependencies [a8ae2f7]
- Updated dependencies [6bea0c5]
- Updated dependencies [8635c1a]
- Updated dependencies [555bd8d]
- Updated dependencies [ae6b2a5]
- Updated dependencies [d97fb3b]
- Updated dependencies [7e90922]
- Updated dependencies [5b0df8a]
- Updated dependencies [78dd590]
- Updated dependencies [d7a156b]
- Updated dependencies [d3f717d]
- Updated dependencies [037e5da]
- Updated dependencies [45f3304]
- Updated dependencies [e377035]
- Updated dependencies [45f3304]
- Updated dependencies [45f3304]
- Updated dependencies [5de2a26]
- Updated dependencies [fd766bf]
- Updated dependencies [e377035]
- Updated dependencies [25de7db]
- Updated dependencies [80b8f57]
- Updated dependencies [fa259b1]
- Updated dependencies [27704ec]
- Updated dependencies [1f8cd0c]
- Updated dependencies [f9386da]
- Updated dependencies [3b34a36]
- Updated dependencies [46ec294]
- Updated dependencies [ae15ab8]
- Updated dependencies [42af0bf]
- Updated dependencies [4c592ae]
- Updated dependencies [6fb8869]
- Updated dependencies [a0d5f84]
- Updated dependencies [6153ae7]
- Updated dependencies [50db4f7]
- Updated dependencies [6a06f54]
- Updated dependencies [3551ece]
- Updated dependencies [fd2cbc8]
- Updated dependencies [959f804]
- Updated dependencies [6b5336b]
- Updated dependencies [e970fad]
- Updated dependencies [dc881e4]
- Updated dependencies [4aaefe7]
- Updated dependencies [3871e2f]
- Updated dependencies [4377fe2]
- Updated dependencies [bce203a]
- Updated dependencies [4b0b9df]
- Updated dependencies [cea89d2]
- Updated dependencies [a23ebea]
- Updated dependencies [62aede0]
- Updated dependencies [e3a1721]
- Updated dependencies [72544b9]
- Updated dependencies [0cc203a]
- Updated dependencies
- Updated dependencies [86019a4]
- Updated dependencies [fd2cbc8]
- Updated dependencies [4bee28f]
- Updated dependencies [50cf32b]
- Updated dependencies [a839c5a]
- Updated dependencies [c4b28e0]
- Updated dependencies [3f7a225]
- Updated dependencies [c62a3d3]
- Updated dependencies [f9427e6]
- Updated dependencies [02f9570]
- Updated dependencies [e000f0a]
- Updated dependencies [642cf3e]
- Updated dependencies [3e93cbe]
- Updated dependencies [06cc87b]
- Updated dependencies [9b65bab]
- Updated dependencies [4d991a3]
- Updated dependencies [c620120]
- Updated dependencies [e20be35]
- Updated dependencies [20abda4]
- Updated dependencies [2bc469b]
- Updated dependencies [072c8da]
- Updated dependencies [dbe20c5]
- Updated dependencies [1420b6b]
- Updated dependencies [28f3eda]
- Updated dependencies [28f3eda]
- Updated dependencies [8063ea0]
- Updated dependencies [66ea1d8]
- Updated dependencies [bffa79c]
- Updated dependencies [7c8117d]
- Updated dependencies [b25b14e]
- Updated dependencies [d040a01]
- Updated dependencies [0714c9d]
- Updated dependencies [c10d7c5]
- Updated dependencies [4c66407]
- Updated dependencies [714e884]
- Updated dependencies [65506e8]
- Updated dependencies [18b99f1]
- Updated dependencies [a6e3e29]
- Updated dependencies [0311cf2]
- Updated dependencies [973af32]
- Updated dependencies [f85be0a]
- Updated dependencies [fcf63e6]
- Updated dependencies [d2589b8]
- Updated dependencies [d145abc]
- Updated dependencies [4cd2028]
- Updated dependencies [3b9be50]
- Updated dependencies [1e604d4]
- Updated dependencies [896dbc0]
- Updated dependencies [b8d9b57]
- Updated dependencies [1e0f516]
- Updated dependencies [2ee80d2]
- Updated dependencies [14b6323]
- Updated dependencies [19333d4]
- Updated dependencies [37e841b]
- Updated dependencies [34194c8]
- Updated dependencies [5c05b86]
- Updated dependencies [4fe1cad]
- Updated dependencies [368fb5f]
- Updated dependencies [dd7e196]
- Updated dependencies [963f8fd]
- Updated dependencies [ba59515]
- Updated dependencies [de71f7d]
- Updated dependencies [87d7436]
- Updated dependencies [c644d57]
- Updated dependencies [6cb67d6]
- Updated dependencies [c644d57]
- Updated dependencies [ae7d97c]
- Updated dependencies [a5c1865]
- Updated dependencies [21eb68a]
- Updated dependencies [b95a75c]
- Updated dependencies [b10284a]
- Updated dependencies [4727ffb]
- Updated dependencies [0b8f43f]
- Updated dependencies [95ca540]
- Updated dependencies [8d7296a]
- Updated dependencies [b91f068]
- Updated dependencies [2a15266]
- Updated dependencies [4950524]
- Updated dependencies [9acb5e0]
- Updated dependencies [dde4d90]
- Updated dependencies [c969f88]
- Updated dependencies [d6f8aac]
- Updated dependencies [c4f5447]
- Updated dependencies [c4f5447]
- Updated dependencies [f57aa89]
- Updated dependencies [a453821]
- Updated dependencies [9566a40]
- Updated dependencies [129da4b]
- Updated dependencies [cd410a7]
- Updated dependencies [29f3da2]
- Updated dependencies [b70bc7f]
- Updated dependencies [beb4333]
- Updated dependencies [07289d6]
- Updated dependencies [800d177]
- Updated dependencies [6de6fae]
- Updated dependencies [c3482db]
- Updated dependencies [8063ea0]
- Updated dependencies [5af6391]
- Updated dependencies [7c6a653]
- Updated dependencies [7010acd]
- Updated dependencies [a4de4bb]
- Updated dependencies [6952fad]
- Updated dependencies [41ee0c2]
- Updated dependencies [65a8393]
- Updated dependencies [654b038]
- Updated dependencies [20b2a58]
- Updated dependencies [4f092a6]
- Updated dependencies [5b84825]
- Updated dependencies [115a979]
- Updated dependencies [4f092a6]
- Updated dependencies [4f092a6]
- Updated dependencies [4f092a6]
- Updated dependencies [fea58eb]
- Updated dependencies [ff1e7a3]
- Updated dependencies [eac1637]
- Updated dependencies [175c611]
- Updated dependencies [a06c164]
- Updated dependencies [9e8b91e]
- Updated dependencies [e841e68]
- Updated dependencies [a5caeed]
- Updated dependencies [4c6e74f]
- Updated dependencies [34b8a3f]
- Updated dependencies [d52edaa]
- Updated dependencies [d52edaa]
- Updated dependencies [d52edaa]
- Updated dependencies [1f815cd]
- Updated dependencies [36358ef]
- Updated dependencies [cde0495]
- Updated dependencies [f76c9ce]
- Updated dependencies [ddfe573]
- Updated dependencies [06d8a05]
- Updated dependencies [c38ba37]
- Updated dependencies [abfbea0]
- Updated dependencies [8d44534]
- Updated dependencies [6b451e0]
- Updated dependencies [99fa753]
- Updated dependencies [3bf2ba1]
- Updated dependencies [c59ac31]
- Updated dependencies [bfbeb0e]
- Updated dependencies [bfbeb0e]
- Updated dependencies [77789e5]
- Updated dependencies [0716fa3]
- Updated dependencies [800e293]
- Updated dependencies [d345d72]
- Updated dependencies [68fa395]
- Updated dependencies [889de90]
- Updated dependencies [68fa395]
- Updated dependencies [e7383b3]
- Updated dependencies [85bd4fb]
- Updated dependencies [d52edaa]
- Updated dependencies [e7383b3]
- Updated dependencies [68ad237]
- Updated dependencies [bcfeaca]
- Updated dependencies [e7383b3]
- Updated dependencies [fc0c7e2]
- Updated dependencies [c113459]
- Updated dependencies [c113459]
- Updated dependencies [91cdd80]
- Updated dependencies [2940a77]
- Updated dependencies [d6b0814]
- Updated dependencies [83ad38f]
- Updated dependencies [83ad38f]
- Updated dependencies [83ad38f]
- Updated dependencies [83ad38f]
- Updated dependencies [83ad38f]
- Updated dependencies [2ab2678]
- Updated dependencies [1f71e57]
- Updated dependencies [fbefe8d]
- Updated dependencies [68fa395]
- Updated dependencies [b8b6281]
- Updated dependencies [87bbefb]
- Updated dependencies [6b8ef6f]
- Updated dependencies [26dac75]
- Updated dependencies [7cd52a0]
- Updated dependencies [4acadb2]
- Updated dependencies [6b8ef6f]
- Updated dependencies [d3025b9]
- Updated dependencies [706f953]
- Updated dependencies [b55b478]
- Updated dependencies [8d28529]
- Updated dependencies [5c52544]
- Updated dependencies [062ab3a]
- Updated dependencies [b4cc74e]
- Updated dependencies [019b253]
- Updated dependencies [6b8ef6f]
- Updated dependencies [c113459]
- Updated dependencies [ffff1b9]
- Updated dependencies [e75c2fa]
- Updated dependencies [68fa395]
- Updated dependencies [4b30753]
- Updated dependencies [8a5ed44]
- Updated dependencies [df2ae04]
- Updated dependencies [9299445]
- Updated dependencies [7ba9d98]
- Updated dependencies [d587928]
- Updated dependencies [29fbe1b]
- Updated dependencies [ba6ddfa]
- Updated dependencies [7e7f2d4]
- Updated dependencies [699c512]
- Updated dependencies [7ba9d98]
- Updated dependencies [26d6c57]
- Updated dependencies [2909824]
- Updated dependencies [33f8369]
- Updated dependencies [a4e0df7]
- Updated dependencies [6bcac6c]
- Updated dependencies [22da2d7]
- Updated dependencies [7bb54fc]
- Updated dependencies [95cb326]
- Updated dependencies [ba39b46]
- Updated dependencies [c113459]
- Updated dependencies [8246dac]
- Updated dependencies [e06225e]
- Updated dependencies [d33e41e]
- Updated dependencies [a71f4e8]
- Updated dependencies [dfedaeb]
- Updated dependencies [5309c93]
- Updated dependencies [856c4c6]
- Updated dependencies [ac6c1d5]
- Updated dependencies [7489853]
- Updated dependencies [0ee638a]
- Updated dependencies [00d3186]
- Updated dependencies [e60e5c1]
- Updated dependencies [937ee67]
- Updated dependencies [7b82ac2]
- Updated dependencies [9138faa]
- Updated dependencies [758459f]
- Updated dependencies [f585154]
- Updated dependencies [2909824]
- Updated dependencies [2ab2678]
- Updated dependencies [ef2d7b2]
- Updated dependencies [2d3d80c]
- Updated dependencies [a7310df]
- Updated dependencies [7e132f6]
- Updated dependencies [151f32a]
- Updated dependencies [68fa395]
- Updated dependencies [33f8369]
- Updated dependencies [7d495c5]
- Updated dependencies [9ee184f]
- Updated dependencies [88c4858]
- Updated dependencies [237bc66]
- Updated dependencies [d1dd27c]
- Updated dependencies [ecf76a1]
- Updated dependencies [bfbeb0e]
- Updated dependencies [3197c9f]
- Updated dependencies [7666c34]
- Updated dependencies [677a841]
- Updated dependencies [b378f99]
- Updated dependencies [278e19f]
- Updated dependencies [0a8bcee]
- Updated dependencies [7129668]
- Updated dependencies [06da484]
- Updated dependencies [c59ac31]
- Updated dependencies [bfbeb0e]
- Updated dependencies [c644d57]
- Updated dependencies [bfbeb0e]
- Updated dependencies [2acd7bc]
- Updated dependencies [d52edaa]
- Updated dependencies [a15119c]
- Updated dependencies [b378f99]
- Updated dependencies [f0f3399]
- Updated dependencies [774063d]
- Updated dependencies [68fa395]
- Updated dependencies [c59ac31]
- Updated dependencies [ce5d609]
- Updated dependencies [6b8ef6f]
- Updated dependencies [c157710]
- Updated dependencies [bc0d76c]
- Updated dependencies [7c007dc]
- Updated dependencies [c46c07b]
- Updated dependencies [ac0379d]
- Updated dependencies [340ab66]
- Updated dependencies [a5c1865]
- Updated dependencies [71adee4]
- Updated dependencies [7cc06b9]
- Updated dependencies [39b41ec]
- Updated dependencies [6494d25]
- Updated dependencies [30bf620]
- Updated dependencies [41f0773]
- Updated dependencies [371b695]
- Updated dependencies [bdc9108]
- Updated dependencies [d268d21]
- Updated dependencies [c4783b4]
- Updated dependencies [de9d942]
- Updated dependencies [cdede50]
- Updated dependencies [edcb456]
- Updated dependencies [f2b94bc]
- Updated dependencies [4198fea]
- Updated dependencies [0ac8104]
- Updated dependencies [475c725]
- Updated dependencies [adca5ed]
- Updated dependencies [c7db707]
- Updated dependencies [ca65c7b]
- Updated dependencies [987dd51]
- Updated dependencies [812c469]
- Updated dependencies [f71667e]
- Updated dependencies [5b8e066]
- Updated dependencies [fca9c3c]
- Updated dependencies [087e02c]
- Updated dependencies [b5df5b3]
- Updated dependencies [413e38c]
- Updated dependencies [55fd480]
- Updated dependencies [3e39fea]
- Updated dependencies [eb070dc]
- Updated dependencies [42ec713]
- Updated dependencies [a9b8fbb]
- Updated dependencies [73f1cf1]
- Updated dependencies [cbc7e4b]
- Updated dependencies [0d0c238]
- Updated dependencies [5354da3]
- Updated dependencies [787ca7b]
- Updated dependencies [721585e]
- Updated dependencies [5202a9f]
  - @weasel-js/ui@2.0.0
  - @weasel-js/core@2.0.0
  - @weasel-js/editing@2.0.0
  - @weasel-js/prefs@2.0.0
  - @weasel-js/gestures@2.0.0
  - @weasel-js/text-tools@2.0.0
  - @weasel-js/registry@2.0.0
  - @weasel-js/devtools@2.0.0
  - @weasel-js/guides@2.0.0
  - @weasel-js/prefs-schema@2.0.0
  - @weasel-js/storage@2.0.0

## 1.19.1

### Minor Changes

- c12b7a7: Delete Page is disabled while the page holds a locked item, instead of throwing, and `DocPages.removable(id)` says so.
  
  `removable` answers `true`, `ActionDisabledReason.NotApplicable` for the last page or one the scene lacks, or `ActionDisabledReason.Locked`; `remove` does nothing where it says no. Use it as a Delete Page command's `enabled`:
  
  ```ts
  useCommand('page.delete', 'Delete Page', () => pages.remove(id), { enabled: () => pages.removable(id) });
  ```
  
  <!-- entry: api fix -->
- 7465634: `isUnreadableKey` says whether a storage key holds an entry `readStored` kept aside as unreadable.
  
  <!-- entry: api -->
- c29c602: `sessionSaveReporter(notice)` reports a document the browser refuses to store. Pass it as `onSaved` to `useAutosave` or `useSessionPersistence`: it raises a toast that stays up while saves fail and takes it down when one lands.
  
  <!-- entry: api new -->
- f37a6aa: `nodeSpecsFromSnapshot` takes `systemLayers`, and with it throws on a snapshot a scene of those layers cannot hold.
  
  That is a node on a layer the scene lacks, or under a parent the snapshot does not have. Read the snapshot inside `readStored` with the layers your scene is built with, and a saved document the app cannot open falls back and is kept aside instead of failing `useScene` on every reload:
  
  ```ts
  readStored(KEY, (raw) => nodeSpecsFromSnapshot(JSON.parse(raw), REGISTRY, reviveTypedArrays, { systemLayers: LAYERS }), starter);
  ```
  
  <!-- entry: api fix -->

### Patch Changes

- 3c9bb27: `useAutosave` writes a pending save when the page turns hidden, so a phone or a discarded background tab keeps the last edits.
  
  <!-- entry: fix -->
- e25f209: Deleting a page also deletes the sources its path effects hid on other pages, in the same undo entry.
  
  <!-- entry: fix -->
- 20574a2: `readStored` keeps an entry it cannot parse under `<key>:unreadable`, with a `console.error`, so the next autosave no longer erases the only copy.
  
  <!-- entry: fix data -->
- b3017e3: `useSessionPersistence` drops the undo stack saved beside a scene whose load fell back, rather than replaying it.
  
  <!-- entry: fix -->
- Updated dependencies [793b472]
- Updated dependencies [c91c39c]
- Updated dependencies [d65a34b]
- Updated dependencies [c93b396]
- Updated dependencies [687501a]
- Updated dependencies [3e8a149]
- Updated dependencies [b1fdbf3]
- Updated dependencies [687501a]
- Updated dependencies [de8f829]
- Updated dependencies [e8de9c3]
- Updated dependencies [e17dbd6]
- Updated dependencies [2bb5cde]
- Updated dependencies [1f42c0c]
- Updated dependencies [34e40b2]
- Updated dependencies [d9a7171]
- Updated dependencies [f0ef9ba]
- Updated dependencies [9b03a7b]
- Updated dependencies [e17dbd6]
- Updated dependencies [a2627b8]
- Updated dependencies [2a32658]
- Updated dependencies [dbbca9f]
- Updated dependencies [3cd42d9]
- Updated dependencies [913a468]
- Updated dependencies [eb6276d]
- Updated dependencies [34dfc04]
- Updated dependencies [ef4ff01]
- Updated dependencies [5e0f965]
- Updated dependencies [c3c9f05]
- Updated dependencies [7f2951f]
- Updated dependencies [a760b7b]
- Updated dependencies [d11f1df]
- Updated dependencies [baa3137]
- Updated dependencies [c12b7a7]
- Updated dependencies [1ba8505]
- Updated dependencies [500c153]
- Updated dependencies [661582d]
- Updated dependencies [5b509a7]
- Updated dependencies [c3c9f05]
- Updated dependencies [73bdfc7]
- Updated dependencies [b39b992]
- Updated dependencies [b39b992]
- Updated dependencies [8ea61a3]
- Updated dependencies [59a1c5f]
- Updated dependencies [5c1d019]
- Updated dependencies [f0946c4]
- Updated dependencies [1f55652]
- Updated dependencies [d3a8b36]
- Updated dependencies [635431c]
- Updated dependencies [60d4ba5]
- Updated dependencies [f6a2555]
- Updated dependencies [9a0d9d1]
- Updated dependencies [e45b7e4]
- Updated dependencies [9bd6635]
- Updated dependencies [2a03672]
- Updated dependencies [7036750]
- Updated dependencies [3e4950e]
- Updated dependencies [58298fa]
- Updated dependencies [88927c3]
- Updated dependencies [c6944f9]
- Updated dependencies [e55e22a]
- Updated dependencies [71c3f85]
- Updated dependencies [7e954c5]
- Updated dependencies [5159b4f]
- Updated dependencies [8cd600b]
- Updated dependencies [57c0cf0]
- Updated dependencies [f58d2be]
- Updated dependencies [4cfff87]
- Updated dependencies [216d193]
- Updated dependencies [e20a471]
- Updated dependencies [b62d643]
- Updated dependencies [36b51a0]
- Updated dependencies [21e7a85]
- Updated dependencies [ce1f1a7]
- Updated dependencies [e0e1f22]
- Updated dependencies [8ada2a6]
- Updated dependencies [607d991]
- Updated dependencies [0cbbb94]
- Updated dependencies [8562ebe]
- Updated dependencies [6d1a52e]
- Updated dependencies [ca3a89a]
- Updated dependencies [6976048]
- Updated dependencies [5461e84]
- Updated dependencies [5c64825]
- Updated dependencies [8941d77]
- Updated dependencies [f611d11]
- Updated dependencies [e70f7a1]
- Updated dependencies [e6959cc]
- Updated dependencies [59485d4]
- Updated dependencies [141697f]
- Updated dependencies [28404b3]
- Updated dependencies [b4e8f97]
- Updated dependencies [f265a52]
- Updated dependencies [a4ef496]
- Updated dependencies [d6dd797]
- Updated dependencies [3fd5c6f]
- Updated dependencies [9f44d6d]
- Updated dependencies [1026b75]
- Updated dependencies [b94121b]
- Updated dependencies [d169db7]
- Updated dependencies [3809dbb]
- Updated dependencies [c438d4a]
- Updated dependencies [90a3dd9]
- Updated dependencies [7ee8a44]
- Updated dependencies [af15d7a]
- Updated dependencies [8b5be0f]
- Updated dependencies [ef15064]
- Updated dependencies [d254251]
- Updated dependencies [f431014]
- Updated dependencies [5526346]
- Updated dependencies [96a1e29]
- Updated dependencies [ef15064]
- Updated dependencies [6b9ac73]
- Updated dependencies [16900c1]
- Updated dependencies [98243b2]
- Updated dependencies [184acd6]
  - @weasel-js/ui@1.19.1
  - @weasel-js/core@1.19.1
  - @weasel-js/geom@1.19.1
  - @weasel-js/prefs@1.19.1
  - @weasel-js/registry@1.19.1
  - @weasel-js/guides@1.19.1
  - @weasel-js/storage@1.19.1

## 1.19.0

### Patch Changes

- 6bd8a56: `useAutosave` writes a save it flushed as the page went away once, and reports it to `onSaved` once.
  
  <!-- entry: fix -->
- b779e72: `useAutosave` waits out a `delayMs` longer than 2³¹ − 1 ms, and an infinite one saves only on unmount or when the page goes away.
  
  <!-- entry: fix -->
- f944665: `docFromSnapshot` reads each document value back as `serializeReplacer` was handed it, so it agrees with the undo stack saved beside it. That includes a value shaped like the writer's `{ "__raw": … }` wrapper or like a tagged typed array.
  
  <!-- entry: rank=-5 fix data -->
- b1309b2: A malformed snapshot is refused with an error naming what is wrong, rather than a `TypeError`. That covers a node that is not an object or lacks a string `id`, `layer` or `kind` (`specsFromSerialized`), `systemLayers` that are not a list of layers (`sceneFromJSON`), and a `core:pages` value that is not a `PagesDoc` (`adoptSnapshotPages`).
  
  <!-- entry: fix -->
- 784fb33: `nodeSpecsFromSnapshot` leaves the snapshot it reads unchanged, handing `revive` a copy of each node's data.
  
  <!-- entry: rank=-5 fix -->
- ca65cf7: A document saved through `serializeReplacer` reads back equal through `reviveTypedArrays`, whatever its data holds. A plain object shaped like a tagged typed array, or plain numbers under a `commands` or `coords` key, is written inside a `{ "__raw": … }` wrapper that the reader takes off; older saves read as before.
  
  <!-- entry: fix data -->
- 25b09cf: `@weasel-js/geom` exports the `{ "__raw": … }` wrapper that keeps lookalike values from being misread on load. `isRawWrapper` and the `RawWrapper` type test for it, and `typedArrayReplacerWrapping` is a `JSON.stringify` replacer that also wraps whatever values a caller's own reader would misread. `typedArrayReplacer` is that replacer with nothing extra to wrap. `@weasel-js/editor`'s `serializeReplacer` and `reviveTypedArrays` build on these.
  
  <!-- entry: api -->
- b1309b2: `@weasel-js/registry` adds `after(ms, fn)`, a timer that waits out any delay. That includes one past the 2³¹ − 1 ms a single timer holds. D3 transition delays use it, and `@weasel-js/editor` and `@weasel-js/d3` now depend on `@weasel-js/registry`.
  
  <!-- entry: new api -->
- 8945e5b: `useSessionPersistence` drops a saved undo stack when the scene saved beside it is missing or unreadable, rather than replaying it.
  
  <!-- entry: fix -->
- Updated dependencies [0896b71]
- Updated dependencies [aaeec8d]
- Updated dependencies [bbfb059]
- Updated dependencies [396a24b]
- Updated dependencies [c73c031]
- Updated dependencies [4413857]
- Updated dependencies [5ceed2d]
- Updated dependencies [65ee9a0]
- Updated dependencies [34b8b1e]
- Updated dependencies [ba20a9d]
- Updated dependencies [7b45877]
- Updated dependencies [6d7fe95]
- Updated dependencies [c0d8f48]
- Updated dependencies [8c4c266]
- Updated dependencies [6ae419d]
- Updated dependencies [efba5cf]
- Updated dependencies [6ff27f5]
- Updated dependencies [b5303e3]
- Updated dependencies [b1309b2]
- Updated dependencies [b5303e3]
- Updated dependencies [b5303e3]
- Updated dependencies [4977d31]
- Updated dependencies [4fd3050]
- Updated dependencies [2cc9303]
- Updated dependencies [b1309b2]
- Updated dependencies [ca65cf7]
- Updated dependencies [f8a6830]
- Updated dependencies [9ec70fe]
- Updated dependencies [d09a6c1]
- Updated dependencies [056d901]
- Updated dependencies [42e088a]
- Updated dependencies [214a57e]
- Updated dependencies [8a41dc2]
- Updated dependencies [433a5ad]
- Updated dependencies [b1309b2]
- Updated dependencies [01e5634]
- Updated dependencies [4ecaf12]
- Updated dependencies [3ed07dc]
- Updated dependencies [25b09cf]
- Updated dependencies [867f10c]
- Updated dependencies [d5a83f9]
- Updated dependencies [799636f]
- Updated dependencies [c09afdf]
- Updated dependencies [e36ca03]
- Updated dependencies [9230203]
- Updated dependencies [3feac74]
- Updated dependencies [b8ea958]
- Updated dependencies [b8ea958]
- Updated dependencies [989d2f6]
- Updated dependencies [d98c770]
- Updated dependencies [089697b]
- Updated dependencies [7ab54e8]
- Updated dependencies [8455e28]
- Updated dependencies [be3fabb]
- Updated dependencies [db69c53]
- Updated dependencies [83730fd]
- Updated dependencies [3686875]
- Updated dependencies [ae708f3]
- Updated dependencies [373e5ee]
- Updated dependencies [6e71013]
- Updated dependencies [2475e40]
- Updated dependencies [0e1a46e]
- Updated dependencies [77f66de]
- Updated dependencies [54c2ae4]
- Updated dependencies [a1ec2f7]
- Updated dependencies [d49fc0b]
- Updated dependencies [437159b]
- Updated dependencies [6af73f3]
- Updated dependencies [a204d0b]
- Updated dependencies [a98d4ee]
- Updated dependencies [a74983a]
- Updated dependencies [d327c41]
- Updated dependencies [7504d6f]
- Updated dependencies [a547bff]
- Updated dependencies [a43fd34]
- Updated dependencies [d83feb6]
- Updated dependencies [14398f2]
- Updated dependencies [965c7b9]
- Updated dependencies [39c0d34]
- Updated dependencies [63edf95]
- Updated dependencies [7620d78]
- Updated dependencies [5f06b1f]
- Updated dependencies [b8ea958]
- Updated dependencies [1fc9a81]
- Updated dependencies [e913291]
- Updated dependencies [44999ca]
- Updated dependencies [faaeb54]
- Updated dependencies [602c78d]
- Updated dependencies [b1309b2]
- Updated dependencies [0e8df4d]
- Updated dependencies [adc2756]
- Updated dependencies [4be628a]
- Updated dependencies [7a7c2ef]
- Updated dependencies [60b297c]
- Updated dependencies [3065fad]
- Updated dependencies [30f5040]
- Updated dependencies [8c7c11a]
- Updated dependencies [8e09cb6]
- Updated dependencies [c6d9ee5]
- Updated dependencies [56a58c9]
- Updated dependencies [b1309b2]
- Updated dependencies [45373d0]
- Updated dependencies [3e4a895]
- Updated dependencies [fef31b7]
- Updated dependencies [2bde466]
- Updated dependencies [f718790]
- Updated dependencies [b1309b2]
- Updated dependencies [1077865]
- Updated dependencies [b1309b2]
- Updated dependencies [b1309b2]
- Updated dependencies [1077865]
- Updated dependencies [1077865]
- Updated dependencies [2bf3397]
- Updated dependencies [1077865]
- Updated dependencies [1077865]
- Updated dependencies [b1309b2]
- Updated dependencies [f137f48]
- Updated dependencies [f0c159d]
- Updated dependencies [caffe33]
- Updated dependencies [18122f9]
- Updated dependencies [4bbda04]
- Updated dependencies [886642a]
- Updated dependencies [b1309b2]
- Updated dependencies [9ea8393]
- Updated dependencies [aa61074]
- Updated dependencies [7b9e651]
- Updated dependencies [6d62197]
- Updated dependencies [b06557b]
- Updated dependencies [efac12a]
- Updated dependencies [5ebb996]
- Updated dependencies [ebab03f]
- Updated dependencies [92adc08]
- Updated dependencies [0a82772]
- Updated dependencies [eaff448]
- Updated dependencies [20c4979]
- Updated dependencies [acba0d3]
- Updated dependencies [436e3d2]
- Updated dependencies [caffe33]
- Updated dependencies [15bc280]
- Updated dependencies [025711f]
- Updated dependencies [65ae35d]
- Updated dependencies [12f254e]
- Updated dependencies [0866208]
- Updated dependencies [96bbb4a]
- Updated dependencies [c38920e]
- Updated dependencies [2fff7ea]
- Updated dependencies [05f0dd7]
- Updated dependencies [3643214]
- Updated dependencies [b1309b2]
- Updated dependencies [d965b03]
- Updated dependencies [b8ea958]
- Updated dependencies [b1309b2]
- Updated dependencies [4e68e7c]
- Updated dependencies [8936d41]
- Updated dependencies [228d835]
- Updated dependencies [0c1c414]
- Updated dependencies [d5f05e2]
- Updated dependencies [b80eae4]
- Updated dependencies [b1309b2]
- Updated dependencies [73fd11f]
- Updated dependencies [30c0e8e]
- Updated dependencies [038a0da]
- Updated dependencies [38223ed]
- Updated dependencies [0a6a876]
- Updated dependencies [faaeb54]
  - @weasel-js/core@1.19.0
  - @weasel-js/geom@1.19.0
  - @weasel-js/guides@1.19.0
  - @weasel-js/ui@1.19.0
  - @weasel-js/prefs@1.19.0
  - @weasel-js/registry@1.19.0

## 1.18.2

### Patch Changes

- 707636a: Fixes to the editor's page stepping, forge's API panel, and labkit's job readout and undo across marks and settings.
  
  - `usePages().step` steps from the page the view is on or was last on. Before, from the gap between pages the next page was always the first and the previous one always the last. A view that has never been on a page steps to the first page either way, and `add` puts a new page after the last one there rather than after page 1. `shown` still falls back to the first page.
  - forge's API panel escapes a quote inside a string literal type it prints from TypeDoc's JSON (an overload's signature), showing `'it\'s'` rather than `'it's'`.
  - `<JobProgress>` sizes its count for the job's total, so the failure count and Cancel button after it stay put as the count gains digits.
  - A new change to a trial's marks drops what its settings, state or scene history could redo, and a new change there drops what the marks could redo. Before, Redo could reapply an undone mark over a later settings change, or the reverse. A `TrialHistorySource` without `undoStamp` and the new optional `dropRedo` keeps the old behavior. `AnnotationsApi` gains `dropRedo`.
  - `<TrialSceneCanvas>` stamps its scene's edits on the same clock as the marks, so a scene edit and a mark made in the same millisecond undo and redo in the order they were made.
  - `History.dropRedo()` (and `scene.history.dropRedo()`) takes the redo stack away and keeps the undo stack, as a push does: a branching history keeps it as a branch, any other evicts it. `History.observe` reports it as a `'drop'` step. A `History` implemented outside weasel needs the new method.
- d373a31: Default keys move off chords a browser or another tool takes first. Each change is breaking for anyone relying on the old key.
  
  - `FILE_KEYS.new`, and so `useNewCommand`'s default, is Alt+N instead of Cmd/Ctrl+N, which every browser keeps for a new window.
  - Free Transform in `DEFAULT_MODES` is entered on Mod+Alt+T instead of Meta+T, which is a browser's new tab. Mod+Shift+T is not used either: it reopens a closed tab. It is still committed with Enter and abandoned with Escape.
  - `useEyedropperTool` has no default hotkey. It used to engage while Alt was held, which shadowed every other tool's Alt-click; pass `hotkey: 'alt'` to keep that.
  - `MenuBar`'s access chord (Alt, with File's F, Edit's E and so on) opens a title only while focus is on one of the bar's titles; F10 still moves focus there from anywhere. Elsewhere the chord passes on to the app's own bindings and to the browser, whose menus Alt+F, E, V and H open off a Mac.
  - `<TrialTransport keys>` answers Space, the arrows, Home and End, R and `<` / `>` only while focus is outside a field, a control and a canvas. Before, a key pressed on a focused canvas (a trial's own) also played, scrubbed or reversed the clock.
  - `<SceneCanvas snap={{ enabled: false }}>` turns snapping off: every gesture runs as though `snap.suspend` (Ctrl) were held, so the pen and spiro place points where they are clicked with no modifier held. `@weasel-js/editor` exports `SNAPPING_KEY`, Mod+Shift+; on the key US layouts put ; on, for an app's snapping toggle.
- Updated dependencies [8048831]
- Updated dependencies [e4b64b6]
- Updated dependencies [895ed9b]
- Updated dependencies [3528360]
- Updated dependencies [115c920]
- Updated dependencies [1549044]
- Updated dependencies [0c77d00]
- Updated dependencies [ea6c53b]
- Updated dependencies [fc38c90]
- Updated dependencies [91b9542]
- Updated dependencies [389a7f9]
- Updated dependencies [7457319]
- Updated dependencies [0e5661d]
- Updated dependencies [3d522ea]
- Updated dependencies [707636a]
- Updated dependencies [30dd2dc]
- Updated dependencies [be6244b]
- Updated dependencies [d16f1ca]
- Updated dependencies [cd61bfa]
- Updated dependencies [d373a31]
- Updated dependencies [07205dd]
- Updated dependencies [5d2451b]
- Updated dependencies [800c96b]
- Updated dependencies [435594a]
- Updated dependencies [8d97dd3]
  - @weasel-js/core@1.18.2
  - @weasel-js/ui@1.18.2
  - @weasel-js/prefs@1.18.2
  - @weasel-js/guides@1.18.2
  - @weasel-js/geom@1.18.2

## 1.18.1

### Patch Changes

- Updated dependencies [7a33153]
- Updated dependencies [f2a1845]
- Updated dependencies [7537af5]
- Updated dependencies [a8da60f]
- Updated dependencies [f4d2261]
- Updated dependencies [112f6bb]
- Updated dependencies [89e4422]
- Updated dependencies [3677316]
- Updated dependencies [4dd9285]
- Updated dependencies [217e52c]
- Updated dependencies [860ab3b]
  - @weasel-js/core@1.18.1
  - @weasel-js/ui@1.18.1
  - @weasel-js/prefs@1.18.1
  - @weasel-js/guides@1.18.1
  - @weasel-js/geom@1.18.1

## 1.18.0

### Patch Changes

- b616cad: Fixes from a second audit of core's scene, viewport, selection and geometry:
  
  - `usePointerStylus` commits the last sample its throttle held back once the gap has passed, so a pen that comes to rest inside the gap no longer leaves the state on an older sample.
  - `unionBounds` folds a box with a negative width or height by the span it covers, as `unionAABB` does.
  - `sceneNodeClientRect` returns a positive rect at the box's screen top-left under a flipped (y-up) view.
  - `RECT_POSE_DESCRIPTOR.lerp` (and `ROTATED_POSE_DESCRIPTOR.lerp`) interpolates `rotation` the short way round, as the descriptor's `axes` do; it carried the start angle through and jumped at the end.
  - `AUTO_POSE_DESCRIPTOR` has a `lerp`, dispatching to the rect or Path descriptor, so `tweenPose` and `springPose` no longer throw on the default descriptor.
  - `setLayerVisible`, `setLayerLocked`, `setLayerParallax` and `renameLayer` record no undo entry and leave the version alone when handed the value the layer already has.
  - A fit with nothing to fit lands on the view Cmd-0 gives. `HOME_VIEW` and `resetView` define that view once: the canvas's `viewport.recenter`, else `HOME_VIEW`, the world origin at 100%. `fitViewToBounds`, `fitViewToPage`, `fitZoom`, `fitToBounds` and `computeFitViewport` now return `null` for content with no extent on either axis (`hasExtent`), with no warning and no fall to `ZOOM_FLOOR`; `fitViewToBounds` no longer hands back the current view for it. This is a breaking change to those return types. `viewport.zoom`'s Fit Content, the off-page follow and the editor's page fits resolve `null` to the reset view, `useAutoCenter` waits for content before it centers, and `ViewAnimationApi.animateToBounds` returns `false` without moving. `fitViewToBounds` fits a lone line along the axis it has; Fit Content no longer centers a lone point at the current zoom, and goes to the reset view instead.
  - `scene.update` and `scene.setPose` record no undo entry, leave the version alone and notify no one when handed the data or pose the node already has, compared by structure as the declared-field setters compare. A drag whose pointer holds still for a frame still lands as one undo entry.
- 02eb957: `usePages().add` puts a new page after the page shown, so a view sitting between pages adds after the one it was last on rather than at the end. It takes an optional `make`, which adds a page of its own at the place and size `add` picked and answers its id. `snapToContainer` no longer offers a drop into a dragged node or one of its descendants, which the scene refused by throwing. Deserialization reads a registry key, and `isLayerVisible` a layer's visibility, only as an own property, so a key or layer id like `toString` no longer resolves through the object's prototype.
- Updated dependencies [4161bcd]
- Updated dependencies [fe6a382]
- Updated dependencies [b7ef242]
- Updated dependencies [c7e8680]
- Updated dependencies [26e836e]
- Updated dependencies [0720167]
- Updated dependencies [c148384]
- Updated dependencies [206b78d]
- Updated dependencies [e405e70]
- Updated dependencies [1ba75a2]
- Updated dependencies [a78c393]
- Updated dependencies [c02f028]
- Updated dependencies [0f72734]
- Updated dependencies [cfe8a8a]
- Updated dependencies [98b212a]
- Updated dependencies [082fa2f]
- Updated dependencies [e63dd06]
- Updated dependencies [324322e]
- Updated dependencies [b93c1dd]
- Updated dependencies [12c538a]
- Updated dependencies [14aa7a8]
- Updated dependencies [b53a3ef]
- Updated dependencies [67d207f]
- Updated dependencies [bdf1a62]
- Updated dependencies [b616cad]
- Updated dependencies [89b2c65]
- Updated dependencies [9b7e5c7]
- Updated dependencies [27d8adb]
- Updated dependencies [56e54c0]
- Updated dependencies [02eb957]
- Updated dependencies [5dbf225]
- Updated dependencies [bf18471]
- Updated dependencies [2455bb4]
- Updated dependencies [bdb314c]
- Updated dependencies [479c893]
- Updated dependencies [8c39a05]
- Updated dependencies [b470ff1]
- Updated dependencies [e3ce292]
- Updated dependencies [a1f2242]
- Updated dependencies [a287c54]
  - @weasel-js/core@1.18.0
  - @weasel-js/geom@1.18.0
  - @weasel-js/prefs@1.18.0
  - @weasel-js/ui@1.18.0
  - @weasel-js/guides@1.18.0

## 1.17.3

### Patch Changes

- Updated dependencies [f9e1b14]
- Updated dependencies [5bda052]
- Updated dependencies [ce9b42d]
- Updated dependencies [49cd9bb]
- Updated dependencies [13c6f66]
- Updated dependencies [778f26d]
- Updated dependencies [542dab5]
- Updated dependencies [56446ad]
- Updated dependencies [13d7e65]
  - @weasel-js/core@1.17.3
  - @weasel-js/ui@1.17.3
  - @weasel-js/geom@1.17.3
  - @weasel-js/guides@1.17.3
  - @weasel-js/prefs@1.17.3

## 1.17.2

### Patch Changes

- 223fb74: `reviveTypedArrays` reads a `commands` or `coords` field as an older save's untagged typed array only when it holds numbers. Node data or op args with such a field holding anything else, such as `commands: ['undo', 'redo']` or `coords: { lat, lng }`, used to come back from a reload as a typed array of zeros.
- Updated dependencies [d15e917]
- Updated dependencies [72b9bde]
- Updated dependencies [3dfa153]
- Updated dependencies [36a16c0]
- Updated dependencies [2e4ad49]
- Updated dependencies [883dfcd]
- Updated dependencies [54dc458]
- Updated dependencies [dd926dc]
- Updated dependencies [cda0a20]
- Updated dependencies [ffa4118]
- Updated dependencies [d162fbb]
- Updated dependencies [7d0c465]
- Updated dependencies [f15f881]
- Updated dependencies [1dda7c2]
- Updated dependencies [dab1602]
- Updated dependencies [35c291a]
- Updated dependencies [47679f8]
- Updated dependencies [e13e539]
- Updated dependencies [9298f90]
- Updated dependencies [c98432d]
- Updated dependencies [5f8b357]
- Updated dependencies [2121adb]
- Updated dependencies [b81f560]
- Updated dependencies [060b0ee]
- Updated dependencies [4825659]
- Updated dependencies [caf38d2]
- Updated dependencies [33c0cbd]
- Updated dependencies [90024bc]
- Updated dependencies [132af78]
- Updated dependencies [03f87f4]
- Updated dependencies [2af51ff]
  - @weasel-js/core@1.17.2
  - @weasel-js/guides@1.17.2
  - @weasel-js/geom@1.17.2
  - @weasel-js/ui@1.17.2
  - @weasel-js/prefs@1.17.2

## 1.17.1

### Patch Changes

- Updated dependencies [f45b9b5]
- Updated dependencies [629d02b]
  - @weasel-js/core@1.17.1
  - @weasel-js/guides@1.17.1
  - @weasel-js/ui@1.17.1
  - @weasel-js/geom@1.17.1
  - @weasel-js/prefs@1.17.1

## 1.17.0

### Patch Changes

- 436da9e: Copy and paste for an app whose own document owns its nodes, with no `InsertAdapter` to write. Core's new `useClipboard` takes the app's `copy(ids)` and `paste(items, at)` functions and returns the `clipboard` dep's shape; `paste` reports the new ids and the copies the next paste steps on from. `useClipboardOps` is now `useClipboard` over an adapter, and behaves as before, except that a copy which finds nothing to take keeps the last copy instead of emptying the clipboard. `@weasel-js/editor`'s `useDocClipboard` adds `clipboard.copy` and `clipboard.paste` commands, bound to Cmd/Ctrl+C and V, and the document undoes the paste. `InsertAdapter.commitPaste`'s docs now say that what it returns becomes the next paste's clipboard, so it must be shaped like `snapshotSelection`'s items.
- Updated dependencies [d28ff77]
- Updated dependencies [a551c73]
- Updated dependencies [217246e]
- Updated dependencies [a161c0b]
- Updated dependencies [34f7531]
- Updated dependencies [bf27898]
- Updated dependencies [533bb6a]
- Updated dependencies [436da9e]
- Updated dependencies [6d8b8af]
- Updated dependencies [2eaa495]
- Updated dependencies [3c517d9]
- Updated dependencies [7e3d359]
- Updated dependencies [6539d70]
- Updated dependencies [c5f7685]
- Updated dependencies [7c26f2b]
- Updated dependencies [ce7e8b5]
- Updated dependencies [b497b07]
- Updated dependencies [75ef6d9]
- Updated dependencies [12e9c39]
- Updated dependencies [9d25103]
- Updated dependencies [3b08834]
- Updated dependencies [ceff0c3]
- Updated dependencies [d5cc782]
- Updated dependencies [ee9bc7f]
- Updated dependencies [0af766f]
- Updated dependencies [e989ef7]
- Updated dependencies [e6cf896]
- Updated dependencies [3a4cc62]
- Updated dependencies [2ebc73f]
- Updated dependencies [b606ef9]
- Updated dependencies [8e888a9]
- Updated dependencies [5f43e16]
- Updated dependencies [71f0ad6]
- Updated dependencies [d53bb96]
- Updated dependencies [8b67fa6]
- Updated dependencies [2d57bf9]
- Updated dependencies [5c0ea38]
- Updated dependencies [454e8e1]
- Updated dependencies [e78e03c]
- Updated dependencies [70113d3]
- Updated dependencies [00fa523]
- Updated dependencies [1f1c990]
- Updated dependencies [d90931a]
- Updated dependencies [84a8be0]
- Updated dependencies [59ddef2]
- Updated dependencies [df080bc]
  - @weasel-js/core@1.17.0
  - @weasel-js/ui@1.17.0
  - @weasel-js/geom@1.17.0
  - @weasel-js/prefs@1.17.0
  - @weasel-js/guides@1.17.0

## 1.16.2

### Patch Changes

- Updated dependencies [1d819e4]
- Updated dependencies [65d2e7c]
- Updated dependencies [db1eb4e]
- Updated dependencies [944faa2]
- Updated dependencies [6c0b311]
- Updated dependencies [f6f69c8]
- Updated dependencies [8f2e1e1]
- Updated dependencies [12d3c17]
- Updated dependencies [6e3b081]
- Updated dependencies [847875c]
- Updated dependencies [12caf33]
- Updated dependencies [f285e56]
- Updated dependencies [6ecee1a]
- Updated dependencies [15f94d3]
  - @weasel-js/ui@1.16.2
  - @weasel-js/core@1.16.2
  - @weasel-js/geom@1.16.2
  - @weasel-js/guides@1.16.2
  - @weasel-js/prefs@1.16.2

## 1.16.1

### Patch Changes

- 6b9d157: `<EditorShell>` now gives every canvas in it default context menus: `editor.selection` on the selection (cut, copy, paste, duplicate, delete; group, ungroup; bring forward, send backward) and `editor.canvas` on empty canvas (paste, select all; undo, redo). An app adds to one by contributing a `MenuDef` with the same id on a canvas `ambient` entry, whose sections follow the editor's; `contextMenus={false}` installs none. The menus are exported as `EDITOR_CONTEXT_MENUS`, and the entry carrying them as `EDITOR_CONTEXT_MENUS_CONTRIBUTION`. This is new default behavior: an app under the shell that already defines its own selection or canvas menu now opens the editor's in its place, since the first matching menu wins, until it moves its items onto the shared ids or passes `contextMenus={false}`.
  
  Core adds `<AmbientContributionsProvider contributions>`: every `<SceneCanvas>` below it installs those entries ahead of its own `ambient`, a canvas's `ambient` entry of the same id replacing a provided one. Nested providers accumulate, an inner entry replacing an outer one of the same id.
- 72330bf: Pages are scene nodes. A paged scene has a page run, a root group that lays out its pages in a column or a row, and each page is a group under it that frames and clips what is on it. Content on a page is that page's child, in the page's own coordinates with the origin at its top-left, so a page's content moves with it and dragging onto another page reparents. A scene with a page run is in Pages mode; one without is Continuous. Pages are 2D only.
  
  This is breaking for a consumer that wrote `core:pages` directly, or placed content on pages in world coordinates: the pages are no longer a document value, and a node on a page is positioned relative to it. Stored scenes convert on load: `adoptLegacyPages` turns a `core:pages` value into page nodes and moves each root onto the page holding it, as one untracked batch. `PAGES_DOC_KEY` remains only as the key that conversion reads.
  
  The page edits (`setPages`, `addPage`, `removePage`, `movePage`, `resizePage`, `renamePage`) and readers (`pagesOf`, `placedPagesOf`) keep their names and now work on the nodes. Content placed outside every page goes onto the nearest page unless the page run's `pasteboard` flag is on. A node that follows others (`dependsOn`, such as a connector) goes on the page its ends share, else into the page run. Pages and the run are never selected, deleted, copied or grouped by the scene tools, and the run refuses drops and inserts of anything but followers. A layer lock never locks a page or the run; only its own `locked` flag does. Group and the boolean group made from members on more than one page put the new group on the page the members overlap most. Turning the pasteboard off puts what sits off every page on the pages, in the same undo entry, and `setPages` on a Continuous scene puts what it holds on the new pages.
  
  Page and run nodes hold `data: undefined` whatever the scene's `TData`, so code walking `scene.nodes` and reading `data` must skip page structure (`isPageStructure`). A page's node id is its page id (`Page.id`) unless another node already held that id when the page was made: then the node gets a fresh id and `PageInfo.id` keeps the page id. `pagesOf`, `placedPagesOf`, `pageOfNode` and the page edits all speak page ids; `pageNodeOf` gives the node for one.
  
  - `@weasel-js/core` exports `createPageRun`, `pageRunOf`, `isPaged`, `pageOfNode`, `PAGE_RUN` and `pageRunLayout`, `PAGE_CLIP` and `pageClip`, `adoptLegacyPages`, `placeOnPages` (moves world-space specs onto their pages, measured by `AUTO_POSE_DESCRIPTOR` unless told otherwise), `addOnPages` (adds specs and places them), `pageNodeOf`, `pasteboardOn`, `replaceDoc` (makes a scene's document values a given set, clearing the rest), `followerHome`, `isPageStructure`, `withoutPageStructure`, `contentRoots`, and, from the routing barrel, `insertSite` with `InsertSite` and `InsertSiteOptions`, whose `descriptor` measures the insert against its page. Nodes gain `page` and `pageRun` fields, which save with the scene, and scenes gain `setPage` and `setPageRun`. `LayoutContainer` and `LayoutChild` gain an optional `node`.
  - `@weasel-js/editor`: `usePages` takes `{ paging }` as its last argument, `'continuous'` (the default) or `'single'`, which settles the view fitted to one page through the new `usePageSettle`. `adoptSnapshotPages` converts a snapshot saved with `core:pages`, which `nodeSpecsFromSnapshot` now does; both take a `pages` option, the pages a snapshot with neither page nodes nor `core:pages` gets. `snapshotRebuildsTree` says whether a load rebuilds the tree, so the undo stack saved beside it is stale, and `useSessionPersistence` drops that stack, taking the same `pages` option. `usePageFit`'s `page` may be `null`.
  - `@weasel-js/diagram`: `OffPageEdgeInput` is now `{ id, fromPage, toPage, offPage? }`, each end's page read from its page ancestor, and `OffPageSplitInput` loses `pages`. `OffPageMarkerOptions` loses `geometry` and its type parameter. A stencil drawn on a paged scene lands on the page under it.
  - `@weasel-js/diagram-formats`: `DocumentScene` gains `pages`. `addDocumentScene` replaces a scene's content, pages and document values with a `DocumentScene` in one undo entry, locked content included, keeping the pasteboard setting; a node in it named like a page no longer collides with that page. `addOnPages` is now core's, re-exported here, and takes the scene's own spec type.
- Updated dependencies [3afef45]
- Updated dependencies [071906a]
- Updated dependencies [214d5d5]
- Updated dependencies [9533421]
- Updated dependencies [6b9d157]
- Updated dependencies [603dbc3]
- Updated dependencies [5a2e82a]
- Updated dependencies [07a8387]
- Updated dependencies [72330bf]
- Updated dependencies [0fcec39]
- Updated dependencies [3905b08]
- Updated dependencies [25a1ff7]
- Updated dependencies [6b503a5]
- Updated dependencies
- Updated dependencies [eebe800]
- Updated dependencies [017246d]
  - @weasel-js/geom@1.16.1
  - @weasel-js/core@1.16.1
  - @weasel-js/ui@1.16.1
  - @weasel-js/prefs@1.16.1
  - @weasel-js/guides@1.16.1

## 1.16.0

### Patch Changes

- Updated dependencies [22451fd]
- Updated dependencies [63056ee]
- Updated dependencies [f9cfd00]
  - @weasel-js/prefs@1.16.0
  - @weasel-js/ui@1.16.0
  - @weasel-js/geom@1.16.0
  - @weasel-js/core@1.16.0
  - @weasel-js/guides@1.16.0

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
