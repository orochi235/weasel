- Unmounting any tools publisher clears the shortcut sheet (A+B): fixed 12e60d3db6
- `'single'` paging misses a pointer already down when it turns on (A+B): fixed 7989a8bebe. Pointers are now tracked while paging is `'continuous'` too, through `useSyncExternalStore`, which returns `false` while off so continuous paging never re-renders. Reading `held.count()` on subscribe alone would not have caught a pointer pressed while no other reader held the shared tracker.
- `usePageFit`'s refit changes identity when `padding` changes (A): fixed 3741056769
- A throwing `onSaved` drops the save queued behind it, leaves the slots cache open and leaves the rejection unhandled (A): fixed e56f9716a4
- A failed save drops its error, and logs nothing without `onSaved` (B): fixed 34361eebe2. B's example does not happen as described: with `localStorage` blocked, `writeSlots` resolves `false`, because the storage layer catches the error and warns, so it never reaches the rejection handler. The handler still threw the error away whenever a save did reject. The test reaches it through a `RecordCache` that throws. `useSessionPersistence`'s `onSaved` doc is updated to match.

No extra defects found while fixing.

Checks:
- `npx vitest run --maxWorkers=1 packages/editor/src/EditorShell.test.tsx`: pass (12/12)
- `npx vitest run --maxWorkers=1 packages/editor/src/usePageSettle.test.ts`: pass (11/11)
- `npx vitest run --maxWorkers=1 packages/editor/src/usePageFit.test.ts`: pass (3/3)
- `npx vitest run --maxWorkers=1 packages/editor/src/useAutosave.test.ts`: pass (10/10)
- `npx vitest run --maxWorkers=1 packages/editor/src/useSessionPersistence.test.ts`: pass (10/10)
- `npm run checks:gate`: pass, "checks:gate: all 32 passed". Earlier runs failed on `react-hooks/set-state-in-effect` and on changeset titles over 140 characters; both were fixed and folded into their commits.
- `npm run lint -w @weasel-js/editor`: not run, because `@weasel-js/editor` has no `lint` script (npm: "Missing script"). In its place, `npx eslint` on every changed file: pass.
- `npm run check:size`: pass
- `npm run check:changesets`: pass

The tree is clean, with five commits on top of b547ac8b3b.