csf.mjs `.lk-root` and draw checks read the host's direct children, which are the scroller (A): fixed f9714e686f

csf.mjs's three JobProgress checks write their screenshots to one path (A): fixed 0535ef5c8a

smoke.mjs's default URL opens forge/Counter, a story removed on 2026-09-25 (B): fixed 2230cc0924 + c0b2fdc2ca. This one needed a call nobody had made, so I made it and recorded it in `docs/unruled.md`: I restored the Counter story as `packages/forge/src/story/Counter.stories.tsx`. The id is still `forge-counter--counter`. The alternative was deleting the smoke check.

csf.mjs's first check opens `ui-button--primary`, which ui/Button doesn't have (B): fixed 0ec522e869. It now opens `ui-button--solid`. The check list moved to `apps/forge/e2e/stories.mjs`. A new test, `apps/forge/e2e.vite.test.ts`, builds the story index with forge's plugin and checks that every story id the two scripts open is in it.

Extra defects found while fixing:
- The deleted Counter story set its starting state through `state:`, but `story()` reads `initialState`. Restored as it was, it would never have stored the `n` that smoke.mjs reads from IndexedDB: fixed c0b2fdc2ca.
- Moving the list into a `.mjs` file broke the root `npm run typecheck` with TS7016 (no declaration file). I added `apps/forge/e2e/stories.d.mts`: fixed 6a01dfb6f0.

Checks:
- `npx vitest run --maxWorkers=1 apps/forge/e2e.test.ts`: pass (3 tests)
- `npx vitest run --maxWorkers=1 apps/forge/e2e.vite.test.ts`: pass (1 test)
- `npm run typecheck:packages -- forge`: pass ("1/1 forge ok")
- `npm run typecheck`: pass
- eslint on every changed file: pass. `stories.d.mts` gets a "File ignored" warning because no eslint config covers `.d.mts` files.
- `npm run check:size`: pass ("no file or function grew past its cap")
- `npm run check:changesets`: pass. I wrote no changesets: everything changed is dev scripts, tests, and a story file that isn't shipped.
- `npm run check:test-projects`: pass
- Unrun: the new Counter story falls under the `forge-stories` browser project, which can't run here. `smoke.mjs` and `csf.mjs` need a running forge dev server, so I didn't run them end to end.