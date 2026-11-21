Async `serveHeadlessPage` call refused as "never called" (A): fixed 3847ed729a. The host now waits up to 30 s for the page to serve; recorded in `docs/unruled.md`.

Page script's own error lost behind "never called" (A): fixed 3847ed729a. Same commit as the one above because the code is the same race; each has its own changeset.

`MAX_RESULT_BYTES` leaves no room for the CDP message around the result (A): fixed 068b91f67d. The limit now leaves 1 MiB for the message.

`dispose()` resolves before a dropped page's browser has closed (A): fixed 5f3afd284f.

`difference` helper compares by byte length only (A): fixed 90ed47dab9. Test-only helper, so no changeset.

`NodeRenderArgs` can't name `camera`, `layers` or `pixelRatio`, and they go unchecked in Node (B): fixed 0c0ca5c982.

Raw snapshot's own `coords`/`commands` numbers reach the page as typed arrays (B): fixed 13d3630c14. A snapshot holding any typed array is now sent as raw. A raw snapshot with no typed array still can't be told from an old save and is read as encoded; recorded in `docs/unruled.md`.

Page whose replacement session never gets a WebGL2 context stays broken (B): fixed fec74bd3d2. The page reports whether it can still render, and the host drops it when it can't.

`dispose()` can resolve while a dropped page's browser is still closing (B): duplicate of A's `dispose()` finding, fixed 5f3afd284f.

`MAX_RESULT_BYTES` bounds only the base64, not the message carrying it (B): duplicate of A's limit finding, fixed 068b91f67d.

Checks:
- `npx vitest run --maxWorkers=1` on `packages/headless/src/host.test.ts`: pass (15). On `protocol.test.ts`: pass (5). On `page.contextLoss.test.ts`: pass (4). On `testing/compareRaster.test.ts`: pass (3). Also ran `protocol.pbt.test.ts`, `protocol.shrunk.test.ts`, `render.pbt.test.ts` and `page.test.ts`: pass.
- `headless.browser.test.ts` and `registered.browser.test.ts` were edited but not run, because browser tests can't run here.
- `npm run checks:gate`: the first run failed on `check:proto-index` at `host.ts:147`. That fix is folded into fec74bd3d2, and the rerun gives "checks:gate: all 32 passed".
- `npm run typecheck:packages -- headless`: "1/1 headless ok".
- `npm run check:changesets`: OK.
- `npm run lint -w @weasel-js/headless`: the package has no lint script. `npx eslint packages/headless/src` instead: pass (exit 0).
- Tree clean.

tally: 10 of 10 fixed, 0 extra fixed