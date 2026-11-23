Imported alias or factory-made `story` dropped from the index (A): fixed 55759e71a7

`returnsStory` misses returns inside `try`, `switch`, loops and labels (A): fixed 9e7ab80358

In-file walk counts a `meta(…)` call as a story (A): fixed 15f14b7076 (wrappers now record whether each local is `meta` or `story`)

`typeText` prints a function inside a union without parentheses (A): fixed d7158978b4 (also groups the operand of `keyof`, `[]` and indexed access)

`prop()` ignores a later spread that overrides a key (A): fixed 52133c92ff. A spread of an object the file writes out is now followed. A spread it cannot read is still taken to set nothing. Treating it as unknown would have sent the title to the auto title in the common case, where the spread has no title. This call is recorded in `docs/unruled.md`.

Default-exported helper not followed, because `bindingsOf` skips `export default` (B): fixed 0e378412ce

An unresolved imported call is taken for "not a story", against `mayBeStory`'s own rule (B): fixed 4217659b4f. A call to what another call returned now stays in too. An existing test that relied on the old guess for an unresolved import now passes the resolution that decides it.

`importers.js` and `deps.js` served before the settle pass (B): fixed 93715810d4. With the previous fix, `importers.js` now lists too many files rather than too few. The reproducing test uses `deps.js`, which titled a helper-made meta by its auto title before the pass.

CSF2 assignments lost on a renamed export (B): fixed 7c76d35e09

A full capture queue answered as "capture unavailable" (B): fixed 244fad833f (now 429 with `Retry-After: 1`)

Checks:
- Each touched test file, run alone with `--maxWorkers=1`: captureClient, capture/endpoint, foreignStories, indexFile, indexStory, plugin and typedoc all pass. Also pass: indexFile.pbt, storyIndex, shellTitle, trace, componentGraph, apiTable, propTypes and forgeTest. No browser test files were touched.
- `npm run checks:gate`: pass ("all 33 passed"). The first run failed on typecheck in typedoc.test.ts; that is fixed in the commit it belongs to.
- `npm run check:changesets`: pass ("OK — 867 changeset(s)"), with no warnings on these changesets.
- `npm run lint -w @weasel-js/forge`: forge has no `lint` script ("Missing script: lint"). Eslint on every changed file: pass.
- The tree is clean apart from `.skulkr/`.

tally: 10 of 10 fixed, 0 extra fixed