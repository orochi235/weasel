labkit.state, audit round 51:

- Stale snapshot kept after another tab's write could not be read here; it was listed as unreadable and could be written back (A1): fixed a632cd7882
- A failed fold put `meta` in the cache, so the next open folded the old document over this session's edits (A2): fixed ba82314589. This was a strict call: the session stops writing. It is recorded in `docs/unruled.md`.
- `openLabStore` left its record cache open when building the store threw (A3): fixed 2356052c64
- An unmounted instrument's parked undo was kept after its trial closed (A4): fixed 5162899237
- `newId`'s fallback minted the same id in two tabs (A5): fixed 55f3cedfa7
- Same fold-without-`meta` defect (B1): duplicate of A2
- `setInstruments` wrote a stale snapshot back over the other tab's record (B2): duplicate of A1
- Unreadable remote snapshot listed twice; discarding it left a loadable snapshot with no record behind it (B3): duplicate of A1
- `setInstruments` rewrote every trial of a changed instrument even when nothing changed (B4): fixed 37c4d16352
- Parked undo kept after its trial was removed (B5): duplicate of A4
- `as3DView` passed an unknown `depth` through when the lens was whole (B6): fixed 0861f6f5e0
- `SingletonExperimentProvider` threw when `id` changed after mount (B7): fixed d1af7441fb. This was a strict call: it keeps the id it mounted with and warns in development. It is recorded in `docs/unruled.md`.
- Fallback ids persisted and shared across tabs (B8): duplicate of A5

Extra: none. Five changeset titles were over 140 characters, which `check:changesets` caught; 7a92972fe5 shortens them.

Checks:
- `npx vitest run --maxWorkers=1`, each on its own: `openLabStore.test.ts` pass (62), `ownUndo.test.ts` pass (7), `helpers.test.ts` pass (10), `view.test.ts` pass (18), `SingletonExperiment.test.tsx` pass (4), `store.test.ts` pass (32), `hydrate.pbt.test.ts` pass (2). Each new test failed against the old code before its fix.
- `npm run check:changesets`: pass ("OK — 2545 changeset(s)")
- `npm run check:size`: pass ("no file or function grew past its cap")
- eslint on the 12 changed source and test files: pass
- biome check on the same files, from `packages/labkit`: pass. It also printed a schema-version notice for `biome.jsonc` that was already there.
- **Not run:** `npm run checks:gate`, `npm run lint -w @weasel-js/labkit`, `npm run typecheck:packages -- labkit` and any `tsc` program. A PreToolUse hook refused each one ("this is the controller — the machine being used"; send it to the fleet). I didn't try to get around it. This means the changes have not been typechecked, and labkit's `check-class-prefix` and `check-design-tokens` scripts have not run. The batch's gate has to cover them.

The tree is clean and `.skulk/` is untouched.

tally: 13 of 13 fixed, 0 extra fixed