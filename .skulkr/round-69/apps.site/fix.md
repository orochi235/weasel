Back/Forward between release pages rewrites the arriving entry's query (A): fixed 8ecee6e29d

Moving to the other release page from the sidebar keeps a stale `?v=` that reroutes the page (B): fixed 8ba63c4101. This is a separate defect from the Back/Forward one, though both are in the same code. A page now keeps a `?v=` only for a version it lists itself.

Failed highlighter chunk takes down the whole demo page (A): fixed 5fcba1d70d. The code panel now catches the failure and shows the source as plain text, so the demo keeps running.

Release chips look up package badges through the prototype chain (B): fixed 7f5b3e9d1b. The lookup now goes through one helper, `packageIcon`, which checks own keys and is used by both `ReleaseEntry` and `ReleaseFilter`.

The DevtoolsSplit browser-test stylesheet models a 280 px sidebar where the site's is 240 px (B): fixed b0f52e68fb. The test's assertions still hold at the real 1200 px width.

No changesets: `apps/site` is not a published package and has no `package.json`, so nothing here reaches a consumer through a release. For the same reason there is no `npm run lint -w` for it; I ran eslint on the changed files instead.

Checks:
- `npx vitest run --maxWorkers=1 apps/site/__tests__/releaseIcons.test.ts`: pass (2)
- `npx vitest run --maxWorkers=1 apps/site/__tests__/Releases.chips.test.tsx`: pass (1)
- `npx vitest run --maxWorkers=1 apps/site/__tests__/Releases.older.test.tsx`: pass (4); the 2 new tests failed before the fixes
- `npx vitest run --maxWorkers=1 apps/site/__tests__/Releases.test.tsx`: pass (16)
- `npx vitest run --maxWorkers=1 apps/site/__tests__/Releases.mount.test.tsx`: pass (5)
- `npx vitest run --maxWorkers=1 apps/site/__tests__/WeaselDemos.routing.test.tsx`: pass (23)
- `npx vitest run --maxWorkers=1 apps/site/__tests__/WeaselDemos.highlighter.test.tsx`: pass (1); failed before the fix
- `npx vitest run --maxWorkers=1 apps/site/__tests__/WeaselDemos.source.test.tsx`: pass (1)
- `apps/site/DevtoolsSplit.browser.test.tsx`: unrun (browser test)
- eslint on the changed `.ts`/`.tsx` files: pass
- `npm run checks:gate`: "checks:gate: all 33 passed"
- The tree is clean.

tally: 5 of 5 fixed, 0 extra fixed