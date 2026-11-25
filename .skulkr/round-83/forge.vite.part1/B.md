## apiTable leaves the files of the type definitions it prints out of `sources`, so they go stale
- where: packages/forge/src/vite/apiTable.ts:39-41,145 (apiTable `define`, refOf `defineType`)
- scenario: a prop typed `size: ChipSize`, with `ChipSize` declared in `sizes.ts` and imported only as a type. `addTypeDefs`/`addTypeDef` (typeDefs.ts) add `ChipSize`'s declaration text to `types`, but only `record(prop)` feeds `sources`, so `sizes.ts` is never watched (propControls.ts:113 watches exactly `sources`). Editing `ChipSize` leaves the index page showing the old definition until something else retransforms the story. Same for the type `ref` holds, defined via `defineType`. Every file a definition is printed from should be recorded.
- evidence: read
- severity: medium

## The component's own file, read for destructured defaults, is not recorded in `sources`
- where: packages/forge/src/vite/apiTable.ts:35,64 (apiTable / destructuredDefaults)
- scenario: `Chip.tsx` declares `function Chip({ size = 'md' }: ChipProps)` with `ChipProps` in `types.ts`. `sources` holds only `types.ts` (from the props), never `declaration.getSourceFile()`. Changing the default to `'lg'` in `Chip.tsx` is accepted by React refresh at `Chip.tsx` itself, so the story module is not retransformed and the API table keeps showing `'md'`. The declaration's file should be added whenever `destructuredDefaults` reads it.
- evidence: read
- severity: low

## destructuredDefaults finds no defaults for a component wrapped by reference (`memo(ChipImpl)`)
- where: packages/forge/src/vite/apiTable.ts:194-200 (destructuredDefaults)
- scenario: `export const Chip = memo(ChipImpl)` or `forwardRef(ChipImpl)`, where `ChipImpl` is a function declared elsewhere in the file with `({ size = 'md' })`. The loop unwraps the call to `arguments[0]`, an Identifier, which is not a function, so it returns no defaults and every default is missing from the table. It handles only an inline function argument; an identifier argument should be resolved to its declaration.
- evidence: read
- severity: low

## Bindings.componentOf keeps only two segments of a dotted `component`
- where: packages/forge/src/vite/bindings.ts:102-109 (componentOf)
- scenario: a meta with `component: Menu.Item.Icon`. `dottedName` gives `Menu.Item.Icon`, and `split('.')` keeps only `[root, member] = ['Menu', 'Item']`, so the graph credits the story to `Item`, a different component, and links the wrong `uses`/`usedBy`. It should either follow every segment or give up (null) past two.
- evidence: read
- severity: low

## parseFile turns on JSX only for `.jsx`/`.tsx`, so a `.js` or `.mjs` story containing JSX fails to index
- where: packages/forge/src/vite/ast.ts:14-16 (parseFile)
- scenario: `Button.stories.js` with `render: () => <Button />` (common in CSF projects, which Storybook's own indexer parses with JSX on). The babel parse throws, and indexFile rethrows as `<file>: Unexpected token`, so the file has no stories. The `typescript` plugin is also turned on for plain `.js`, where `<T>x` reads differently.
- evidence: read
- severity: low

## fileDates misses paths that git C-quotes, so those components get no history
- where: packages/forge/src/vite/history.ts:13-14,46-48 (runGit / fileDates)
- scenario: `core.quotepath=off` stops octal escaping only for bytes above 0x80. A source path containing `"`, `\`, a tab or a newline is still printed by `git log --name-status` as `"src/a\"b.tsx"`, which never equals the followed name, so the file gets no created/modified dates or versions. Reading the log with `-z` would avoid the quoting.
- evidence: read
- severity: low

## passThrough sends the original request headers on to a redirect's new origin
- where: packages/forge/src/vite/capture/browser.ts:73-79 (passThrough)
- scenario: a story fetches allowlisted `https://a.example/x` with an `Authorization` header, and `a.example` redirects to allowlisted `https://b.example/y`. Each hop calls `fetchImpl(url, { headers: request.headers() })` with the original headers, so the credential goes to `b.example`. fetch's own redirect handling would have dropped `Authorization` when crossing origins. A hop that changes origin should drop credential headers.
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
