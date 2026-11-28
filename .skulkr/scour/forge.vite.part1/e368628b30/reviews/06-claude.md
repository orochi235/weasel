## componentOf's forge-wrapper check rejects a `meta` the story indexer accepts (namespace of a re-exporting module, `export *` from forge)
- where: packages/forge/src/vite/componentOf.ts:107 (isForgeWrapper)
- scenario: `import * as h from './storyHelpers'` where storyHelpers has `export { meta } from '@weasel-js/forge'`, and the story file does `export default h.meta({ component: Button })`. `foreignCallees` (indexFile.ts:73-79) reports `h.meta` as a namespace-member callee, the wrapper resolver finds forge's `meta` behind it, and the indexer treats the file as native. `isForgeWrapper` only accepts a namespace import whose own specifier is `@weasel-js/forge` (`fromForge(d)` on the NamespaceImport), so `objectOf` stops at the call, `assigned` finds no `component`, and `componentOf`/`metaComponentOf` fall back to the title stand-in or the meta type's `component` property (props `any`). The same happens for a named import from a helper that does `export * from '@weasel-js/forge'`: `getImmediateAliasedSymbol` jumps straight to forge's own declaration and never meets a specifier whose text is `@weasel-js/forge`, so the loop ends false. The doc comment says "The story indexer reads no other call as a meta, so neither does this", but the indexer reads both cases. Expected: one answer for whether a callee is forge's `meta`/`story`. Actual: the args table and the component graph get a different component from the one the index reports (or none).
- evidence: read
- severity: medium
- fix: packages/forge/src/vite/componentOf.ts
- size: function
- cause: wrapper check reimplemented narrower than the indexer's resolver
- confidence: likely

## componentOf's `objectOf` does not follow an identifier inside a cast, or a cast or call in a spread, where the babel indexer does
- where: packages/forge/src/vite/componentOf.ts:72 (objectOf), packages/forge/src/vite/componentOf.ts:137 (componentIn)
- scenario: `const meta = { component: Button }; export default meta satisfies Meta<typeof Button>;`. Because the default export is not a bare identifier, TS creates no alias symbol for it. Its declaration is an ExportAssignment whose expression is a SatisfiesExpression. The loop unwraps that to the Identifier `meta` and then gives up, since Identifier is neither an object literal, a call, nor a cast. `assigned` returns undefined, so the args table loses the component, or `metaComponentOf` reads the `Meta` type's `component` and gets `any` props. In the same way, a spread `...(base as Meta)` or `...meta({ component: X })` in componentIn goes through `getSymbolAtLocation` on a non-identifier expression, which yields no symbol, so the component the spread carries is dropped. The babel side (`ast.ts` objectOf/lookup) follows identifiers through casts and wrapper calls in both positions, so the indexer's `componentName` and the TS-side component disagree.
- evidence: read
- severity: low
- fix: packages/forge/src/vite/componentOf.ts
- size: function
- cause: identifier/cast/call not unwrapped in TS-side object resolution
- confidence: likely

## Allowlisted capture responses keep only the last Set-Cookie header
- where: packages/forge/src/vite/capture/browser.ts:89 (passThrough)
- scenario: a capture page loads from an origin in `capture.allowOrigins`, and that origin answers with two `Set-Cookie` headers (for example a consent cookie and a session cookie). Iterating the fetch `Headers` yields each `set-cookie` as a separate entry. `Object.fromEntries` then overwrites all but the last, so the page only ever receives one cookie, and a later request that depends on the dropped one behaves differently from the real page. Expected: every cookie forwarded, joined as Playwright's `fulfill` accepts, or taken from `getSetCookie()`.
- evidence: read
- severity: low
- size: line
- cause: multi-valued header collapsed into a record
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

<!-- done: 3 findings, files read: 27 -->
