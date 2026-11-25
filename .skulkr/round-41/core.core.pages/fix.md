Zero-thickness box goes to the earliest page it touches, not the one holding most of its length (A+B) — fixed 099f551502

`createPageRun` on an already-paged scene makes a second run that every page reader ignores (A+B) — fixed 69eecb4839 (my call: it throws; recorded in `docs/unruled.md`)

`adoptLegacyPages` throws a raw `TypeError` on a `core:pages` value that is not a `PagesDoc` (A+B) — fixed 323d8650af (the editor's `checkPagesDoc` moved into core as `pagesDocFault` and is used by both adopters)

An unknown `align` (`'middle'`, or `'toString'` found on the prototype) or a string `gap` lays pages out at NaN, in `layoutPages` and in a loaded `pageRun` (A+B) — fixed ca36b4f454 (`pageLayoutFault`; `layoutPages` throws on bad options, and loading a scene refuses a saved page run holding them)

Extra defects found while fixing: the editor's `adoptSnapshotPages` checked that `layout` was an object but none of its fields — sweep, fixed in 323d8650af by the shared check.

Checks:
- `npx vitest run --maxWorkers=1`, each file on its own: `pages.test.ts` pass (23), `pageNodes.test.ts` pass (11), `legacyPages.test.ts` pass (19), `scene.serialization.test.ts` pass (33), `editor/src/snapshot.shrunk.test.ts` pass (2). The pages directory, the editor's `src`, and every non-browser test file calling `createPageRun` also pass. `offPage.browser.test.tsx` is unrun because it needs a browser.
- `npm run checks:gate`: pass ("all 32 passed"). The first run failed `check:changesets` (three titles over 140 characters); I fixed those and squashed the fixes into their commits.
- `npm run lint -w @weasel-js/core` and `-w @weasel-js/editor`: fail with `Missing script: "lint"`. Neither package has a lint script. As a substitute, `npx eslint` on every changed `.ts` file: pass.
- The tree is clean.