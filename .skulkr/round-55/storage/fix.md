Subscribe-throws-on-first-read (A+B) — fixed ba01f7942a. The first read now subscribes inside its `try`, so a throwing `subscribe` counts as a failed read. `localStorageAdapter.subscribe` no longer throws where the browser blocks site data, which also stops `createRecordCache` from throwing there.
Heard delete of a record the cache lacks doesn't void an in-flight read-back (A) — fixed 31b3215d5f
`pickFile` never settles without a `cancel` event (A) — fixed 4544f4df3e. When the window regains focus, it waits 500 ms, then resolves with the chosen file or `null` and removes its input.
Subscribe-throws-on-first-read (B) — duplicate of A's finding, fixed ba01f7942a
Read-back compares structured-clone values by identity (B) — fixed 8b1ef9589b. The new `cloneEqual` compares a `Map`, `Set`, `Date`, `RegExp`, buffer or typed array by content, and works across realms. I removed the matching "Open:" note from `docs/unruled.md`.
A reconcile read that throws drops the contested record (B) — fixed 0f451cfdc0. A failed read-back keeps the record contested and reads it again on the cache's `retryMs` backoff. With `retryMs: false` it waits for the next write of ours to land.
`flush()` after `close()` still sends writes (B) — not a defect: `docs/unruled.md` records it as "Left as is: it may be the intended retry path".
IndexedDB transaction rejects with `null` (B) — fixed 15ed220c4d
`isJsonSafe` calls an object with symbol keys safe (B) — fixed b65de1f1dc
`pickFile` never settles without a `cancel` event (B) — duplicate of A's finding, fixed 4544f4df3e
Percent-encoded fragment reads as empty, and the next write wipes it (B) — fixed ab1bcfbf98

Extra:
`isJsonSafe` called an object with a non-enumerable own key safe, though JSON drops that key too (sweep) — fixed b65de1f1dc, in the same commit as the symbol-key fix.

Checks:
- `npx vitest run --maxWorkers=1`, one file at a time: firstRead.test.ts pass (3), remote.test.ts pass (4), indexedDb.test.ts pass (8), json.test.ts pass (3), urlHash.test.ts pass (3), fileIO.test.ts pass (4), webStorage.test.ts pass (5), records.test.ts pass (44), adapters.test.ts pass (80). The storage pbt and longWait files, run together as one invocation, also pass (33).
- `npm run checks:gate`: 31 of 32 passed, and `check:changesets` failed on five titles over 140 characters. I shortened those titles and folded them into their commits, then reran `npm run check:changesets` alone: pass ("OK — 2597 changeset(s)"). I did not rerun the whole gate afterward. Only changeset text changed after it ran.
- `npm run lint -w @weasel-js/storage`: not run, because the package has no `lint` script (npm: "Missing script: \"lint\""). The root `npm run lint` passed inside the gate.
- No `*.browser.test.*` files were touched. The tree is clean.

tally: 10 of 11 fixed, 1 extra fixed