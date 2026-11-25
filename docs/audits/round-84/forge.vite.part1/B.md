## Issues endpoint answers any Host and Origin, so a DNS-rebound page can read the private repo, branch, commit and issue list
- where: packages/forge/src/vite/issues/endpoint.ts:143 (serveIssues middleware)
- scenario: `serveIssues` is registered straight from `configureServer` (plugin.ts:199), so it runs ahead of vite's internal host-validation middleware (`server.allowedHosts`). A page on `evil.example` that rebinds its name to 127.0.0.1 fetches `/__forge/issues?component=Button` same-origin and reads the JSON: the `origin` slug of a private repo, the branch, the HEAD commit and the titles/URLs of open issues, listed with the developer's own `gh` login. The capture endpoint in the same plugin rejects a foreign `Origin` (`ownOrigin`) for this reason; the issues endpoint checks neither `Origin` nor `Host`. It should reject a request whose Host/Origin is not this server's, as capture does.
- evidence: read (endpoint has no check; plugin.ts:199 registers it directly in configureServer); vite middleware ordering is from memory of vite's createServer
- severity: medium

## `hmrSocketOf` falls back with `??` where vite's client falls back with `||`, so an empty `hmr.host` or `hmr.protocol` throws and fails every capture
- where: packages/forge/src/vite/capture/endpoint.ts:68-71 (hmrSocketOf)
- scenario: vite's client uses `__HMR_HOSTNAME__ || importMetaUrl.hostname` and `__HMR_PROTOCOL__ || …`. With `server.hmr: { host: '' }`, `options.host ?? page.hostname` gives `''` and `new URL('ws://:5173')` throws "Invalid URL"; the call sits inside `capture`'s try, so every POST answers 500. With `protocol: ''` the same. Should be `||`, matching the client it claims to follow.
- evidence: read
- severity: low

## The API table falls back to a story-file-local wrapper when no import matches the title, where the dependency graph finds no component
- where: packages/forge/src/vite/componentOf.ts:29-38 (componentOf)
- scenario: meta `{ component: LocalWrapper }` where `LocalWrapper` is declared in the story file and no import is named for the title's last segment. `imported` is undefined, so `symbol` stays the local wrapper and the props table shows the wrapper's props. The comment says the wrapper "is the story's, not the component's, as the dependency graph reads it", and `bindings.componentOf` indeed returns null for the same file (the wrapper is not an import). One decision answered two ways: the API panel documents a component the graph says is absent. Should return null (or the graph should accept it) consistently.
- evidence: read
- severity: low

## `forgeTest` emits nothing for a story file with no indexable stories, so vitest fails it with "No test suite found"
- where: packages/forge/src/vite/forgeTest.ts:62-63 (transform)
- scenario: a story file matched by the test include whose stories are all removed by `excludeStories`/`includeStories`, or one holding only a meta: `entries` is empty, `title` is undefined and the transform returns undefined, leaving a module that registers no test; vitest reports the file as a failure rather than as having nothing to run. It should still emit an empty registration (or a skipped placeholder).
- evidence: read; vitest's behavior on an empty file is inference
- severity: low

## `unquoted` encodes a C-quoted git path one UTF-16 unit at a time, mangling any astral character
- where: packages/forge/src/vite/history.ts:27-31 (unquoted)
- scenario: with `core.quotepath=off`, git writes a path holding a `"`, a backslash or a control character quoted, with non-ASCII bytes raw. A path such as `docs/"x" 🎨.stories.tsx` reaches the loop with the emoji as two surrogate code units; `Buffer.from(ch, 'utf8')` encodes each lone surrogate as U+FFFD, so the decoded name never matches the followed path and the file gets no history. Iterate by code point (`for…of`, or `codePointAt`).
- evidence: read
- severity: low

## A `var` inside a class `static {}` block is scoped to the wrong function in both scope walkers
- where: packages/forge/src/vite/freeNames.ts:110-112 (walk, StaticBlock case); packages/forge/src/vite/ast.ts:72-82 (varNames)
- scenario: a static block is its own `var` scope. `freeNames` walks `StaticBlock` with only its lexical names, so `static { var x = 1; use(x) }` reports `x` as a free reference to a top-level `x`. `ast.ts`'s `varNames` does not stop at `StaticBlock` (not in `FUNCTIONS`), so the same `var` is taken as the enclosing function's, hiding an assignment to the top-level `x` elsewhere in that function from `assignedNames`; a reassigned top-level `let x` is then read as its initializer. The two files keep separate copies of these scope rules that already disagree (freeNames' `varNames` stops at non-statements, ast's walks everything).
- evidence: read
- severity: low

## The component's label goes to `gh --label`, a comma-split CSV flag, unescaped
- where: packages/forge/src/vite/issues/endpoint.ts:115-119 (answer)
- scenario: `gh issue list --label` is a string-slice flag, parsed as CSV: `?component=Foo,Bar` filters on the two labels `forge:Foo` and `Bar` (AND), and a component holding a `"` makes gh fail its flag parse, answered as a 502. The `more` link also wraps the label in unescaped double quotes. The label should be validated or rejected when it holds `,` or `"`.
- evidence: read; gh's flag type is from memory of its source
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
