# Audit round 82, forge.vite.part1 — blind reviewer findings

## componentOf's `assigned` ignores spreads, so the API table and the dependency graph can name different components
- where: packages/forge/src/vite/componentOf.ts:82 (assigned)
- scenario: a meta written `{ component: Old, ...base }` where `base = { component: New }`, or `{ ...base }` alone. `assigned` takes the last property literally named `component` and skips every `SpreadAssignment`, so it answers `Old` (or nothing, and then falls back to the title's import). The indexer's `componentName` reads the same meta through `ast.prop`, which follows a later spread and answers `New`. The props table shows one component's API while the graph and the dossier name another. It should follow a spread after the property, as `ast.prop` does.
- evidence: read
- severity: medium

## `module()` stores a graph built for the old root after `reset()`
- where: packages/forge/src/vite/depsFeed.ts:85 (module)
- scenario: a page requests `deps.js`, the root changes (`reset()` bumps `generation` and clears `depsSent`), and then the old build finishes. `module` never compares the generation, unlike `rebuild`. It sets `depsSent` to the old root's graph and serves it, so the page shows the previous root's components until an edit produces a graph that differs. It should drop or rebuild a result whose generation is stale.
- evidence: read
- severity: low

## freeNames treats a parameter default as shadowed by the body's `var`
- where: packages/forge/src/vite/freeNames.ts:108 (walk, function case)
- scenario: `function C(p = Icon) { var Icon; … }`. `inner` adds `varNames(n.body)` before the params' defaults are walked in it. JS gives defaults their own scope, so this `Icon` refers to the top-level `Icon`, but it is never reported. The component graph then misses a use of the `Icon` component. Defaults should be walked in a scope that holds only the params.
- evidence: read
- severity: low

## componentReach decides "outside the home directory" by a string prefix
- where: packages/forge/src/vite/componentReach.ts:66 (walkFile)
- scenario: a helper in the component's own directory whose name starts with `..` (`..shared.ts`) gets `relative()` = `..shared.ts`, which `startsWith('..')`, so it is skipped and the components it renders are missing from `uses`. On Windows, a helper on another drive gets an absolute `relative()` that does not start with `..`, so it is walked although it is outside the directory. Test the first path segment for `..` and for `isAbsolute` instead.
- evidence: read
- severity: low

## ast `lookup` lets an earlier key win over a later computed key
- where: packages/forge/src/vite/ast.ts:268 (lookup)
- scenario: `{ title: 'A', ['title']: 'B' }` or `{ name: 'x', [`name`]: 'y' }`. A computed property is skipped with `continue`, so the earlier literal property answers 'A', while at runtime the object holds 'B'. The index then gives the story the wrong title or name. A computed key that is a string literal or an expression-free template should be read like a plain key, and any other computed key should stop the lookup as unknown.
- evidence: read
- severity: low

## The capture page's protocol comes from `server.https`, which middleware mode does not set
- where: packages/forge/src/vite/capture/endpoint.ts:151 (serveCapture)
- scenario: vite in `middlewareMode` mounted on the host app's own `https.createServer`. `server.config.server.https` is unset, so `protocol` is `http`. The page URL Chromium loads is `http://<addr>:<tls port>/…`, which fails, and `ownOrigin` rejects the browser's real `https://` Origin with a 403. The protocol should be read from the request socket (`req.socket.encrypted`).
- evidence: read
- severity: low

## repoOf drops a URL remote's port
- where: packages/forge/src/vite/issues/endpoint.ts:34 (URL_FORM / repoOf)
- scenario: a GitHub Enterprise remote `https://ghe.example.com:8443/org/app.git`. `(?::\d+)?` matches the port but does not capture it, so `url` becomes `https://ghe.example.com/org/app` and `ghRepo` becomes `ghe.example.com/org/app`. The issues link and the `more` link point at the wrong server, and `gh -R` asks the wrong host. An HTTPS port should be kept in the host. An SSH port can be dropped, since that remote's web host is the bare host.
- evidence: read
- severity: low

## Files read
packages/forge/src/vite/apiTable.ts
packages/forge/src/vite/ast.ts
packages/forge/src/vite/autoTitle.ts
packages/forge/src/vite/bindings.ts
packages/forge/src/vite/build.ts
packages/forge/src/vite/capture/browser.ts
packages/forge/src/vite/capture/cache.ts
packages/forge/src/vite/capture/endpoint.ts
packages/forge/src/vite/capture/entries.ts
packages/forge/src/vite/capture/payload.ts
packages/forge/src/vite/componentGraph.ts
packages/forge/src/vite/componentOf.ts
packages/forge/src/vite/componentReach.ts
packages/forge/src/vite/depsFeed.ts
packages/forge/src/vite/entries.ts
packages/forge/src/vite/folderTitles.ts
packages/forge/src/vite/foreignStories.ts
packages/forge/src/vite/forgeTest.ts
packages/forge/src/vite/freeNames.ts
packages/forge/src/vite/history.ts
packages/forge/src/vite/html.ts
packages/forge/src/vite/index.ts
packages/forge/src/vite/indexFile.ts
packages/forge/src/vite/indexStory.ts
packages/forge/src/vite/isolateReport.ts
packages/forge/src/vite/issues/answer.ts
packages/forge/src/vite/issues/endpoint.ts

<!-- done: 7 findings, files read: 27 -->
