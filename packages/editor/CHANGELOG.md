# @weasel-js/editor

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
