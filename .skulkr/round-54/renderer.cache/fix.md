- Aligned (inside/outside) `{ px }` glyph outline stroke ignored the stroke metric, so its width changed with direction under a stretched or sheared map (A+B, reported by both): fixed 10993e7d38. The aligned branch now passes `P⁻¹` as `strokeToPath`'s `frame`, the same way the centered branch already passed `metric`. The new test in `outlineStrokeMeshCache.test.ts` failed before the fix and passes after it. The commit includes a changeset (`fix visual`).

I found no extra defects. `strokeToPath` has no other call in renderer that leaves out the metric.

Checks:
- `npx vitest run --maxWorkers=1 packages/renderer/src/cache/outlineStrokeMeshCache.test.ts`: Tests 5 passed (5)
- `npm run check:changesets`: OK, 2590 changesets (the first run failed on a 163-character title; I shortened it and it passed)
- `npm run checks:gate`: all 32 passed
- `npm run lint -w @weasel-js/renderer`: could not run, because the package has no `lint` script. I ran `npx eslint` on the two changed files instead, and it passed.
- The working tree is clean apart from `.skulk/`.

tally: 1 of 1 fixed, 0 extra fixed