# forge.vite.part1 findings

## The TypeScript meta reader can't follow a meta object passed by name, though the babel indexer can, so the two disagree on which component a story file documents
- where: packages/forge/src/vite/componentOf.ts:85 (objectOf)
- scenario: `const config = { title: 'ui/Buttons/Primary', component: Button }; export default meta(config);`, or `const m = base; export default m;`. Babel's `objectOf` (ast.ts:262) follows the identifier argument and the `const` alias through `bindings`, so the index's `componentName` is `Button` and the component graph keys `Button`. The TS `objectOf` loop accepts only object literals, wrapper calls and casts. Hitting `Identifier`, it sets `node = undefined`, so `assigned()` returns undefined. `componentOf` then falls back to the title stand-in (`Primary`), finds no such import and returns null: no API table or prop controls. `metaComponentOf` instead falls back to `named`, the property `component` declared on forge's own meta type, so `apiTable`'s `component` becomes `{ name: 'component', file: <forge's types> }` and the TypeDoc lookup searches the wrong file. The same split happens for `f.meta({...})` when `f` is a namespace import of a project module that re-exports forge: babel's `foreignCallees` and the wrapper resolution count `f.meta` as a wrapper, but `isForgeWrapper` only accepts a namespace import taken straight from `@weasel-js/forge`.
- evidence: read
- severity: medium
- fix: packages/forge/src/vite/componentOf.ts
- size: function
- cause: TS objectOf doesn't resolve identifiers, unlike babel objectOf
- confidence: likely

## A story file with a syntax error fails without naming the file, because `indexStoryResolved` parses it with `foreignCallees` before `indexFile`
- where: packages/forge/src/vite/indexStory.ts:41 (indexStoryResolved), packages/forge/src/vite/indexFile.ts:57 (foreignCallees)
- scenario: a story file with a syntax error, transformed by `forgeTest` or indexed by the workshop. `foreignCallees` calls `parseFile` with no try/catch, so babel's bare SyntaxError ("Unexpected token (3:5)") escapes. The `${file}: …` wrapping in `indexFile` (indexFile.ts:37) is never reached, so the message gives no file name.
- evidence: read
- severity: low
- fix: packages/forge/src/vite/indexFile.ts
- size: line
- cause: file-name wrapping on only one of two parse paths
- confidence: sure

## A passed-through response keeps only its last Set-Cookie header
- where: packages/forge/src/vite/capture/browser.ts:96 (passThrough)
- scenario: an allowlisted origin answers with two `Set-Cookie` headers. Iterating a fetch `Headers` yields each `set-cookie` as its own entry, and `Object.fromEntries` keeps only the last. The capture page gets one cookie where a real browser would get both, so the page can render differently from the screen.
- evidence: read
- severity: low
- size: line
- cause: multi-valued header collapsed by Object.fromEntries
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
