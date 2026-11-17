# Audit 29 — core-A (core and its state)

## Scene document values are shared by reference with `toJSON()` snapshots and with the snapshot a load reads, unlike poses and data
- where: packages/core/src/core/scene/docValues.ts:43 (`createDocStore.toJSON`), :47 (`reset`); packages/core/src/core/scene/sceneState.ts:61 (`toJSON`); packages/core/src/core/scene/docValues.ts:69 (`SceneDoc.set`)
- scenario: `const snap = scene.toJSON(); (snap.doc!['diagram:theme'] as any).accent = 'red'` writes straight into the value the scene holds: the scene's `doc.get('diagram:theme')` changes with no `kit:setDoc` op, no history entry and no notify, and the next `toJSON` carries it. The same in reverse: `sceneFromJSON(json)` / `loadState(json)` store `json.doc`'s objects as they are, so the caller editing its `json` afterward edits the live document. Node poses and `data` go through `detach` both ways (`serializeScene`'s `copy`, `currentSpecs`' `detach(n.pose)`), and are `own()`-frozen in development; doc values get neither — `doc.set(key, obj)` neither freezes nor copies, so a caller mutating `obj` after `set` also rewrites the value the undo entry's `from`/`to` hold. One question ("is a snapshot the caller's to edit?") answered two ways in one snapshot.
- evidence: read
- severity: medium

## `scene.history.goto` clamps or silently ignores a depth that `History.goto` now throws a `RangeError` for
- where: packages/core/src/core/scene/historyFacade.ts:147 (`history.goto` → `methods.jumpToHistoryIndex`, :111–118); contract at packages/history/src/historyTypes.ts:99–106 and packages/history/src/history.ts:47 (`gotoDepth`)
- scenario: 9078cfb8f4 (2026-11-16) made `History.goto(n)` throw a `RangeError` for `n` that is not a whole number in `[0, total]`, and the `History` contract says it throws while a journal is active. The scene's facade is typed `History` and handed to the kit's `history` dep, but `scene.history.goto(99)` jumps to the end, `goto(-1)` to 0, `goto(1.5)` / `goto(NaN)` do nothing and return, and with a journal open it only `dwarn`s. Code written against `History` (a timeline scrubber, a test of the contract) behaves one way on `createHistory(...)` and another on `scene.history` for the same call — a decision answered twice, and the facade still carries the behavior the commit message calls the bug ("did nothing").
- evidence: read
- severity: low

## Opening, suspending or resuming a journal on `scene.history` flips `scene.canUndo()`/`canRedo()` with no notification
- where: packages/core/src/core/scene/historyFacade.ts:90,103–104 (`stack()`, `canUndo`/`canRedo`); packages/core/src/core/scene/sceneJournals.ts:60 (`suspend`), :103–107 (`begin`, `resume`)
- scenario: the scene's `canUndo` answers from the active journal when there is one, else the engine. `scene.history.beginJournal(...)` makes the journal active (canUndo true → false on a scene with entries), `journal.suspend()` hands it back to the engine (false → true), and `scene.history.resumeJournal(j)` back again — but none of the three calls `notify()`, and the engine's own `subscribe`/`getVersion` (which `scene.history` forwards) do not bump on them either. A toolbar reading `scene.canUndo()` under `scene.subscribe` (devtools' `page/history.ts` does) keeps showing the old state: after a suspend the Undo button stays disabled though `scene.undo()` would now step the engine, until some unrelated edit notifies. `commit` and `cancel` in the same wrapper do notify, for this reason ("the parent's undo depth changes and listeners read that").
- evidence: read
- severity: low

## A scene with its own `opRegistry` still rebuilds restored ops from `defaultOpRegistry`, unbound to any adapter
- where: packages/core/src/core/scene/sceneRecording.ts:91–96 (engine built with `rebuildOp: outer.rebuild` and no `opRegistry`); packages/core/src/core/ops/createHistory.ts:35 (`custom?.(…) ?? opRegistry.rebuild(…)`, `opRegistry` defaulting to `defaultOpRegistry`); packages/core/src/core/scene/outerOps.ts:87–94 (`rebuild` returns `null` for a name its registry lacks)
- scenario: `createScene({ ..., opRegistry: createOpRegistry() })` (parent KIT, so it does *not* see `registerOpFactory` names, which go to `defaultOpRegistry`) — or `createOpRegistry({ parent: null })`, documented to "resolve nothing but this registry's own". Elsewhere on the page `registerOpFactory('myOp', …)` runs. `scene.restoreHistory(snap)` with an entry naming `myOp`: `outer.rebuild` answers `null` (unknown here), so the kit wrapper falls through to `defaultOpRegistry.rebuild('myOp', args)` and returns that op raw — not `bindOpToHistoryAdapter`-wrapped and not refused as `'no-adapter'`. A strict restore that should throw `HistoryRestoreError(unknown)` succeeds; the first undo across the entry calls the op's `apply(undefined)` (the scene engine has no adapter), which throws a plain error or writes nothing instead of a `RestoredOpError`. The scene's registry isolation (ExtensionRegistry's "hosts that should not see each other's extensions each make their own") leaks through the engine's fallback.
- evidence: read
- severity: medium

## A misconfigured `layerGroups` warns on every painted frame, in production too
- where: packages/core/src/core/layers/layerGroup.ts:74,83 (`groupMembership`); packages/core/src/core/layers/render.ts:210,243 (`drawLayers`); called per paint from packages/core/src/canvas/useCanvasPaint.ts:136 and canvas/renderWorker/workerStack.ts:80
- scenario: `<Canvas layerGroups={[{ id: 'fx', layers: ['scenery'] }]}>` where no layer is `scenery` (or a layer two groups claim, or a group whose members a third layer splits). `drawLayers` rebuilds the membership and re-checks runs on every frame, so each `console.warn` fires once per paint — 60 a second during a pan or animation — and in a production build, since none of the three is gated on `isDev()`. The sibling check one line above, `warnUnknownOrderIds` for `layerOrder`, warns once per id and only in development: the same kind of mistake is reported two different ways.
- evidence: read
- severity: low

## `addPage` with an id the scene already has adds nothing and rewrites the existing page instead
- where: packages/core/src/core/pages/pageEdits.ts:133–142 (`addPage`), :102–107 (`setPages` loop and `orderPages`); packages/core/src/core/pages/pageNodes.ts:144–147 (`pagePoses` keyed by id)
- scenario: a paged scene with `page-1`, `page-2`; `addPage(scene, { id: 'page-1', width: 300, height: 300 }, { index: 2 })`. `setPages` gets two entries named `page-1`: `pageNodeOf` finds the existing node for both, so no page is added; `pagePoses`' map keeps the second entry's pose, so the existing `page-1` is resized to 300×300 and placed where the third page would have gone, `orderPages` is handed the same node twice, and one "Add page" undo entry records it. Nothing throws, though the edits beside it now throw on a page id the scene lacks (b29a94e963) and `nextPageId` exists to mint a free one. Duplicate ids inside a `setPages(scene, { pages })` call do the same.
- evidence: read
- severity: low

## `readLocal` turns plain text that happens to be valid JSON into another type
- where: packages/storage/src/webStorage.ts:108–119 (`readLocal`, doc "Text stored as plain text, not JSON, reads back as itself"); packages/storage/src/json.ts:5–11 (`parse`)
- scenario: a setting an older build wrote with `localStorage.setItem('app.version', '2')`, `setItem('app.flag', 'false')` or `setItem('app.theme', 'null')` — plain text, not JSON. `readLocal('app.version')` answers the number `2`, `'app.flag'` the boolean `false`, `'app.theme'` `null` (not `undefined`, the "no value" answer); only text that fails `JSON.parse` comes back as itself. A first render comparing `readLocal(k) === '2'` or treating `null` as absent reads the wrong value. The promise in the doc holds only for text that is not also a JSON literal.
- evidence: read
- severity: low

<!-- done: 7 findings, files read: 78 -->
