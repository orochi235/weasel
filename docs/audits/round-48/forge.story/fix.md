Finding 1, native story named `''` is named `''` where the indexer names it by its export (A): fixed 06ae4bc696

Finding 2, `primaryFile` misses `ColorField.stories.tsx` for the title `ui/Color Field` (A): fixed 193055ea0b. The comparison now ignores case and separators on both sides. 6a3a2e5fcb shortens that fix's changeset title to the 140-character limit.

Finding 3, a story on a shared index page renders with the primary entry's title instead of its own (A): fixed 654a985425

Finding 4, the same `primaryFile` miss for `ui/Segmented Bar` and `ui/segmented-bar` (B): duplicate of finding 2

Finding 5, the same shared-index-page title mismatch (B): duplicate of finding 3

No extra defects found.

Checks:
- `npx vitest run --maxWorkers=1 packages/forge/src/story/native.test.tsx`: pass (5/5); the new test failed before the fix
- `npx vitest run --maxWorkers=1 packages/forge/src/story/indexPages.test.ts`: pass (5/5); the new test failed before the fix
- `npx vitest run --maxWorkers=1 packages/forge/src/story/indexBundle.test.tsx`: pass (4/4); the new test failed before the fix
- `npm run check:changesets`: pass ("[changesets] OK — 2233 changeset(s).")
- `npx eslint` on the six changed files: pass
- `npm run checks:gate`: unrun
- `npm run lint -w @weasel-js/forge`: unrun
- `npm run typecheck:packages -- forge`: unrun
- `npm run check:size`: unrun

The four unrun checks were refused by this machine's PreToolUse hook. It reads this machine as the controller and sends suite-sized scripts to the fleet, and the brief forbids fleet runs. The batch's gate still needs to run them. The tree is clean.

tally: 5 of 5 fixed, 0 extra fixed