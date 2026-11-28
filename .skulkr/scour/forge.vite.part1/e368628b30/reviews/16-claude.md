# Findings: forge.vite.part1

## componentOf's forge-wrapper check misses `meta`/`story` reached through a project module's `export * from '@weasel-js/forge'`, which the indexer accepts
- where: packages/forge/src/vite/componentOf.ts:105 (isForgeWrapper)
- scenario: `helpers.ts` has `export * from '@weasel-js/forge'`; a story does `import { meta } from './helpers'; export default meta({ component: Button })`. The indexer follows the star (trace.ts `declaring` walks `mod.stars`) and reads this as a native meta. `isForgeWrapper` follows only alias symbols whose declaration is an import/export specifier from `'@weasel-js/forge'`. `export *` makes no specifier, so `getImmediateAliasedSymbol` jumps straight to forge's own export, whose specifier is relative, and the check returns false. `objectOf` then stops at the call, `assigned` finds no `component`, and `metaComponentOf`/`componentOf` return no props or the wrong component. The same file is answered two ways: a story for the index, no meta for the API and prop controls.
- evidence: read
- severity: medium
- fix: packages/forge/src/vite/componentOf.ts
- size: function
- cause: wrapper recognition doesn't follow star re-exports
- confidence: likely

## A failed import resolution is cached as null until the importer itself changes
- where: packages/forge/src/vite/bindings.ts:46 (createBindings resolveFrom)
- scenario: `resolve(spec, importer)` rejects once (a plugin's resolveId throws while a file is mid-write, or the env isn't ready yet). The `() => null` handler stores a resolved `null` promise in `resolutions`, the map shared across builds. Every later graph build treats that import as unresolvable, so the component loses its `uses` edge, until the importer is edited or a file add/unlink calls `reset()`. A transient error should not be stored like a real "not a source file" answer.
- evidence: read
- severity: low
- size: line
- cause: rejection memoized like a real answer
- confidence: likely

## Proxied capture responses keep only one `Set-Cookie` header
- where: packages/forge/src/vite/capture/browser.ts:88 (passThrough)
- scenario: an allowlisted origin answers with two `Set-Cookie` headers. Undici's `Headers` iterator yields each `set-cookie` as its own entry, and `Object.fromEntries` keeps only the last. The captured page gets one cookie, not both, and can render differently from the screen. Use `response.headers.getSetCookie()` or Playwright's `headersArray`.
- evidence: read
- severity: low
- size: line
- cause: multi-value header flattened through an object
- confidence: likely

## `tags` written with a spread element are silently dropped from the index
- where: packages/forge/src/vite/indexFile.ts:221 (tagsOf)
- scenario: `tags: [...sharedTags, 'beta']` with `const sharedTags = ['autodocs']`. `stringOf(SpreadElement)` is undefined, so `flatMap` drops it, and the entry gets `['beta']` where the runtime story carries both. The `!tag` removal in `combineTags` then works on an incomplete set. `valueOf` can already follow the spread's argument through top-level consts, so each spread could be expanded the way `lookup` expands object spreads.
- evidence: read
- severity: low
- size: function
- cause: array spreads not followed
- confidence: sure

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

<!-- done: 4 findings, files read: 27 -->
