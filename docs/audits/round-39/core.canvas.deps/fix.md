- Transform preview of extension-changed nodes differs from the commit (A): fixed 8fe7b71735. The preview is now read off the same `otherOps` the commit writes, through `writtenBy`, so data-only changes and the stripped generator/geometry data show during the drag. It also now uses the `data` that earlier followers previewed, which it used to ignore.
- Held `editAnchors` dep's setters use the editing id and state captured at read (A+B): fixed 7f5717f277. Every setter, `setHandleLocks` included, now reads `stateRef.current` and its editing id at call time.
- `insertSite` keeps a node on its page only when the parent is the page node itself (B): fixed 43bb27681d. With the pasteboard off, a node inserted into a container on a page is now kept partly on it, because the code takes the page `pageIdOf` finds by walking up the parent's ancestors. `pasteOnPages` only ever resolves page nodes, so it doesn't have the same problem.
- `kindOfNode` dep is registered even under `routing={[]}` (B): fixed 0781d60e9b. The dep is now absent while the ref holds no resolver. `contextMenu`'s `requires: ['kindOfNode']` only names the dep (`createActionDeps` doesn't gate on it being there), and it reads the dep with `?.`, so nothing breaks.

No extra defects found.

Checks:
- `npx vitest run --maxWorkers=1`, one file at a time:
  - `packages/core/src/canvas/deps/pathEditCommits.test.ts`: pass (3)
  - `packages/core/src/canvas/deps/editAnchors.test.tsx`: pass (9)
  - `packages/core/src/canvas/deps/insertSite.test.ts` (new): pass (2)
  - `packages/core/src/canvas/deps/dispatchSources.test.tsx` (new): pass (1)
  - `packages/core/src/canvas/scrollView.test.ts`: pass (10)
  - `packages/core/src/canvas/deps/editAnchors.rotation.test.ts`: pass (4)
  - Each new test failed against the HEAD version of its source file.
- `npm run typecheck:packages -- core`: pass ("1/1 core ok")
- eslint on the 8 changed files: pass
- `npm run check:size`: pass ("sizes: no file or function grew past its cap.")
- `npm run check:changesets`: pass ("OK — 1827 changeset(s)"). It first failed on two titles over 140 characters; I shortened them and folded the fix into each one's own commit.
- No `browser` tests were touched. The tree is clean apart from `.skulk/`.