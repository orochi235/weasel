# Audit round 47, area `editor`

Note: commit 44e73a944bea29d4d56fc7883fa302daec48ecf1 is not in this repository (`git cat-file` reports a bad
object). HEAD is 782733b19c, and the working tree has uncommitted changes, `packages/editor/src/snapshot.ts` among
them. The files below were read as they stand in that working tree.

## Unmounting any tool publisher clears the shortcut sheet's tools, even while a newer publisher is still mounted
- where: packages/editor/src/shortcutSheet.tsx:21-25 (usePublishEditorTools)
- scenario: two canvases in one `<EditorShell>` each call `usePublishEditorTools`, as a split view does. A mounts
  and publishes, then B mounts and publishes, so B wins. When A unmounts, its cleanup runs `publish(null)`, and the
  sheet falls back to `tools: null` while B is still mounted and holding its tools. The doc says "The newest caller
  wins; unmounting withdraws them". Unmounting should withdraw only the caller's own publication and leave B's in
  place, or put back the previous one. The cleanup has to check that the published value is still its own.
- evidence: read
- severity: medium

## useAutosave drops a failed write's error and, without `onSaved`, logs nothing
- where: packages/editor/src/useAutosave.ts:69-70 (save → start)
- scenario: with no `records`, `writeSlots` calls `slot(key)`, which runs `openRecordsSync` over `localStorage`
  inside the async function (sessionStore.ts:27). Where reading `localStorage` throws, as in a sandboxed iframe or
  with storage blocked, `writeSlots` rejects. The rejection handler is `() => onSaved?.(false)`: the error is
  thrown away, and an app that gave no `onSaved` gets no log at all. That differs from the throwing-`write` path
  three lines above, which passes the error to `onSaved` and otherwise calls `console.error`, as `AutosaveOptions`
  documents. The two failure paths should report the same way.
- evidence: read
- severity: low

## usePageSettle misses a pointer already held when single paging turns on
- where: packages/editor/src/usePageSettle.ts:34-45 (usePointerDown)
- scenario: switch paging to `'single'` from a keyboard command while a pointer is still down, mid-pan or
  mid-drag. The effect subscribes to `heldPointers` but never reads `held.count()` up front, so `down` stays false
  until the next pointer change. The settle timer then fires 150 ms later and moves the view under the held pointer,
  which the doc says never happens ("never while a pointer is down"). The effect should start with
  `setDown(held.count() > 0)`.
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

<!-- done: 3 findings, files read: 22 -->
