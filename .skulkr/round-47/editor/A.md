I couldn't write `.skulk/out/findings.md` because the permission was denied, so the whole findings document is below.

# Audit round 47, area `editor`: reviewer findings

Note: the brief names frozen commit 44e73a944bea29d4d56fc7883fa302daec48ecf1, but this clone doesn't have that object (`git cat-file` says "bad object"). What I read is the working tree at HEAD 782733b19c. Of the listed files, only `packages/editor/src/snapshot.ts` has uncommitted edits.

## Unmounting the newest tools publisher withdraws every publisher's tools from the shortcut sheet
- where: packages/editor/src/shortcutSheet.tsx:21-25 (usePublishEditorTools)
- scenario: two canvases under one `<EditorShell>` each call `usePublishEditorTools`. A publishes, then B publishes and wins. When B unmounts (say a surface closes), its cleanup calls `publish(null)`. The sheet then lists no tools at all, even though A is still mounted with its tools. The reverse also happens: when A's effect re-runs (a new `toolSets` array or a new registry), it runs `publish(null)` and then `publish(A)`, taking the sheet away from B. The host keeps a single slot (`useState<ShellTools | null>`) rather than a stack of publishers. So the doc's "unmounting withdraws them" actually withdraws everyone's tools. It should fall back to a publisher that is still mounted.
- evidence: read
- severity: medium

## A throwing `onSaved` drops the save queued behind it and leaves its slots cache unclosed
- where: packages/editor/src/useAutosave.ts:69-77 (save / start), also lines 50 and 93
- scenario: `start` resolves through `.then((ok) => onSaved?.(ok), () => onSaved?.(false))`, so if `onSaved` throws, `run` rejects. Any save scheduled while that one was in flight was chained as `busyRef.current.then(start)`, so its `start` never runs. Its entries are never written and its `onSaved` is never called. Two more effects follow:
  - `void run.finally(...)` also rejects, and nothing handles it.
  - `idle().then(() => held.slots.close())` (run when `records` changes or on unmount) never calls `close`, so the caches `sessionSlots` opened stay open.

  Each save should start whatever happened to the one before it, e.g. `.then(start, start)`, or a catch around `onSaved`.
- evidence: read
- severity: low

## `usePageFit`'s refit changes identity when `padding` changes, against its doc
- where: packages/editor/src/usePageFit.ts:30-44 (usePageFit)
- scenario: the docstring says the returned refit's "identity never changes", for `viewport.recenter`. But `recenter` is a `useCallback` with `padding` in its deps. A caller passing a different `padding` (a pref, or an inline value computed each render) gets a new function. Anything that registered the first one, such as a command or a dep, keeps calling the old closure with the old padding. The fix is to read `padding` through a ref like the other inputs, or to correct the doc.
- evidence: read
- severity: low

## `'single'` paging ignores a pointer already held when it turns on
- where: packages/editor/src/usePageSettle.ts:34-46 (usePointerDown)
- scenario: `usePointerDown` starts at `false` and only updates inside the `subscribe` callback. It never reads `held.count()` when it subscribes. If `paging` switches to `'single'` (through a pref or a key bound to it) while a pointer is held mid-pan, `down` stays false until the next pointer change. Holding still for `PAGE_SETTLE_MS` then settles the view under the held pointer, which the doc says never happens "while a pointer is down". It should call `setDown(held.count() > 0)` right after subscribing.
- evidence: read
- severity: low

## Files read
packages/editor/src/EditorShell.tsx
packages/editor/src/TextEditDepPublisher.tsx
packages/editor/src/contextMenus.ts
packages/editor/src/editorCommands.ts
packages/editor/src/editorPrefs.tsx
packages/editor/src/fileCommands.ts
packages/editor/src/fileWarnings.ts
packages/editor/src/index.ts
packages/editor/src/menuBar.ts
packages/editor/src/paperLayer.ts
packages/editor/src/pbt.fixture.ts
packages/editor/src/sessionSaveNotice.ts
packages/editor/src/sessionStore.ts
packages/editor/src/shortcutSheet.tsx
packages/editor/src/snapshot.ts
packages/editor/src/useAutosave.ts
packages/editor/src/useDocClipboard.ts
packages/editor/src/usePageFit.ts
packages/editor/src/usePageGrid.ts
packages/editor/src/usePageSettle.ts
packages/editor/src/usePages.ts
packages/editor/src/useSessionPersistence.ts

<!-- done: 4 findings, files read: 22 -->