Namespace import of forge indexed as CSF (A): fixed dfb1fc1f7c. A file that imports forge as a namespace and calls `forge.meta(…)` is now indexed as native. A namespace import of a helper module that re-exports forge's `meta` or `story` resolves the same way.

Shadowing local or parameter counted as a component use (A): fixed 798ada704a. A new scope-aware `freeNames.ts` replaces `namesIn`, so a parameter, inner `const` or `catch` binding with a component's name no longer counts as using it.

moduleInfo drops `export enum`, `export * as` and destructured `export const` (A): fixed 721f305f44. A `const` destructured off a namespace import now binds like a named import. An `export * as` re-export no longer falls through to `export *`.

Duplicate story id within one file reported as two files (A): fixed ddc888cfb7. The warning and `check:forge-titles` now name the file once, list both exports, and say to rename one of them.

watchRecovery's `read` map keeps entries for failed loads (A): fixed c8577d344f. An entry a minute old is now dropped on the next load. The other half of the claim, that another environment's transform takes the client's stamp, is not a defect: the test I wrote for it passed on the old code, because that transform records the stamp itself. d757653de5 moved the helper out so `check:size` passes.

Story ids built from the raw export name, and meta `id` ignored (B): fixed db214becd6. `LoggedIn` now gives `example-page--logged-in`. A meta's `id` reaches the loaders through a new optional `metaId` on index entries. The e2e id `draw-commandbar--emptydocument` in `apps/forge/e2e/stories.mjs` was updated to `draw-commandbar--empty-document`. The changeset is `major` with the `breaking` tag, because saved links and ids of multi-word stories change. The release level is still your call. The Storybook side rests on how its well-known template ids are built (`example-page--logged-in`); Storybook isn't installed here, so I didn't run it.

`tags`, `includeStories`/`excludeStories` and viewport sides read only when written inline (B): fixed ff79d27aa0. `isolate` now follows a top-level `const` too, for the same reason.

`github.com-<account>` SSH alias taken as a GitHub Enterprise host (B): fixed e4cf68acdc.

No extra defects. 92f4ad9d92 only shortens five of my changeset titles to under 140 characters.

Checks:
- Each touched test file, one at a time with `--maxWorkers=1`: pass.
- `vitest related --project=forge` over the id and loader files: pass (152 files, 1365 tests).
- `npm run checks:gate`: the first run failed on `check:size` (`watchRecovery.ts`, longest function 125 lines); after d757653de5, all 33 passed.
- `npm run check:changesets`: pass.
- `npm run typecheck:packages -- forge`: pass.
- `npm run lint -w @weasel-js/forge`: not run, because forge has no lint script. The root `npm run lint` passed inside the gate.

tally: 8 of 8 fixed, 0 extra fixed