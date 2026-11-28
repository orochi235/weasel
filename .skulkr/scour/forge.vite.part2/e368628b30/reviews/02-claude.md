## A server restart that reuses forge's plugin objects closes the new server's capture endpoint
- where: packages/forge/src/vite/plugin.ts:198 (forge, configureServer / closeServer)
- scenario: a dev server built programmatically (`createServer({ plugins: [forge(...)] })`, or any inline config whose plugin objects survive `server.restart()`, e.g. on an `.env` change). vite's `restartServer` (node_modules/vite/dist/node/chunks/node.js:25206) creates the new server first, which runs `configureServer` and sets the shared `capture` to the new endpoint, then awaits `server._closeServer('restart')`, whose `closeServer` hook runs `capture?.close()` — on the new endpoint. The old endpoint is never closed and the live server's capture endpoint is shut down. It should close the endpoint the closing server opened (keep it per server, or only close when `capture` belongs to the server being closed).
- evidence: read (vite restart order read in node_modules)
- severity: medium
- size: function
- cause: module-level state overwritten before the old server's teardown
- confidence: likely

## The same restart order clears the new server's sweep timer in watchRecovery
- where: packages/forge/src/vite/watchRecovery.ts:172 (watchRecovery, buildEnd) and :150 (configureServer)
- scenario: with a plugin instance reused across `server.restart()` (inline config), the new server's `configureServer` assigns `timer = setInterval(sweep, …)`, overwriting the old handle without clearing it; then the old server's teardown calls `buildEnd`, which clears `timer` — the new interval. The old interval stays alive (unref'd, but it keeps sweeping `stamps` and replaying changes through the now-reassigned `server`), and the live server never sweeps, so a missed edit is only recovered on request. `stamps`/`fileOfUrl` also carry over from the old server. Clear the previous timer in `configureServer` and tie teardown to the server that set it.
- evidence: read
- severity: low
- size: function
- cause: one timer slot shared by successive servers
- confidence: likely

## Two copies of "the nearest package.json's name" answer it differently
- where: packages/forge/src/vite/typedoc/index.ts:102 (packageNameOf)
- scenario: `typedoc/index.ts` defines its own `packageNameOf(dir)` (undefined on none, no `top` bound, starts at the dir given) beside `packageName.ts`'s exported `packageNameOf(file, top)` (null on none, bounded by `top`, starts at `dirname(file)`), which `apiTable.ts` and `history.ts` use. The same question has two implementations that can drift; `exportIn` should call `packageNameOf(file)` from `packageName.ts`.
- evidence: read
- severity: low
- fix: packages/forge/src/vite/typedoc/index.ts
- size: function
- cause: duplicated lookup
- confidence: sure

## packageNameOf's `top` bound is a string prefix, not a path prefix
- where: packages/forge/src/vite/packageName.ts:6 (packageNameOf)
- scenario: `dir.startsWith(top)` accepts a sibling directory sharing the prefix: with `top = '/repo/pkg'` and a file resolved to `/repo/pkg-old/src/x.ts` (history.ts resolves `top` + a path that can climb with `..`), the walk reads `/repo/pkg-old/package.json`, which is outside `top`, and names that package instead of returning null. Compare against `top` with a separator (`dir === top || dir.startsWith(top + sep)`).
- evidence: read
- severity: low
- size: line
- cause: string prefix used as path containment
- confidence: likely

## Files read
packages/forge/src/vite/moduleInfo.ts
packages/forge/src/vite/nativeExports.ts
packages/forge/src/vite/ownEntries.ts
packages/forge/src/vite/ownKeys.ts
packages/forge/src/vite/packageName.ts
packages/forge/src/vite/plugin.ts
packages/forge/src/vite/posixPath.ts
packages/forge/src/vite/propControls.ts
packages/forge/src/vite/propTypes.ts
packages/forge/src/vite/servePages.ts
packages/forge/src/vite/shellTitle.ts
packages/forge/src/vite/storyGlob.ts
packages/forge/src/vite/storyIndex.ts
packages/forge/src/vite/storybookShims.ts
packages/forge/src/vite/titleReport.ts
packages/forge/src/vite/trace.ts
packages/forge/src/vite/typeDefs.ts
packages/forge/src/vite/typedoc/index.ts
packages/forge/src/vite/typedoc/json.ts
packages/forge/src/vite/typedoc/print.ts
packages/forge/src/vite/virtualModules.ts
packages/forge/src/vite/warnOnce.ts
packages/forge/src/vite/watchProbe.ts
packages/forge/src/vite/watchRecovery.ts
packages/forge/src/vite/watchSettle.ts
packages/forge/src/vite/wrappers.ts

<!-- done: 4 findings, files read: 26 -->
