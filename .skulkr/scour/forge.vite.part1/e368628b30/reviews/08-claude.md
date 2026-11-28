# Findings: forge.vite.part1

## A rebuild queued before `reset()` runs for the new root and marks the graph as sent though no page asked for it
- where: packages/forge/src/vite/depsFeed.ts:73 (createDepsFeed → rebuild / reset)
- scenario: An edit lands while a rebuild is running, so `coalesced` holds it in `next`. Then `reset()` runs for a new root: it bumps `generation` and sets `depsSent = null`, meaning no page has asked for this root's graph yet. When the queued run starts, it reads `started = generation` (the new value), builds the new root's graph, finds `json !== depsSent` (null), and sets `depsSent`, invalidates `deps.js` and pushes `forge:deps`. Every later edit then rebuilds the graph and runs git for a root whose graph no page has asked for. What should happen: `reset` drops the queued call, or the run checks against the generation in effect when the call was queued.
- evidence: read
- severity: low
- fix: packages/forge/src/vite/depsFeed.ts
- size: function
- cause: coalesced queue survives reset; generation captured at run start, not at enqueue
- confidence: likely

## A package's version can be read from another package's tag whose name has a path segment starting with a digit or `v`+digit
- where: packages/forge/src/vite/history.ts:139 (createHistoryReader → load, name-rev `--refs`)
- scenario: `git name-rev --refs=<pattern>` matches the pattern against every `/`-separated tail of the ref name, and its wildmatch `*` also matches `/`. So `--refs=[0-9]*` and `--refs=v[0-9]*`, meant to catch unscoped `1.2.0` or `v1.2.0` tags, also match a scoped package's tag such as `@scope/3d@1.0.0` (its tail `3d@1.0.0` matches `[0-9]*`) or `@scope/v2-utils@4.0.0`. A component in another package can then get `introduced`/`modifiedIn` set to that package's version. What should happen: anchor the unscoped patterns to the full ref, e.g. `--refs=refs/tags/v[0-9]*`, and `refs/tags/[0-9]*` refined to exclude `/`.
- evidence: read (git builtin/name-rev.c `subpath_matches` behavior, from memory)
- severity: low
- fix: packages/forge/src/vite/history.ts
- size: line
- cause: name-rev --refs matches ref name subpaths
- confidence: likely

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

<!-- done: 2 findings, files read: 27 -->
