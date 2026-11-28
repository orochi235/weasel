## typedoc/index.ts keeps a second `packageNameOf` beside packageName.ts's, answering "which package is this file in" in two places
- where: packages/forge/src/vite/typedoc/index.ts:102 (packageNameOf)
- scenario: packageName.ts exports `packageNameOf(file, top)` (used by apiTable.ts and history.ts); typedoc/index.ts defines a private copy with a different signature (a dir, `undefined` instead of `null`, no `top` bound). A fix to one (e.g. the prefix bound below, or how an unreadable manifest is treated) does not reach the other, so `exportIn`'s package tie-break and apiTable's package label can name different packages for one file.
- evidence: read
- severity: low
- fix: packages/forge/src/vite/typedoc/index.ts, packages/forge/src/vite/packageName.ts
- size: function
- cause: duplicated lookup
- confidence: sure

## `packageNameOf` treats a sibling directory that shares `top`'s string prefix as inside `top`
- where: packages/forge/src/vite/packageName.ts:6 (packageNameOf)
- scenario: `top = '/repo/pkg'`, `file = '/repo/pkg-extra/src/a.ts'` (history.ts passes `resolve(top, path)`, which a `../` path takes outside). `dir.startsWith(top)` is true for `/repo/pkg-extra/src` and `/repo/pkg-extra`, so the manifest of `pkg-extra`, outside `top`, names the file; it should return null once the walk leaves `top`. The test needs a separator boundary (`dir === top || dir.startsWith(top + sep)`).
- evidence: read
- severity: low
- size: line
- cause: string-prefix containment test
- confidence: sure

## TypeDoc source paths written with `../` never match, so the component gets no TypeDoc docs
- where: packages/forge/src/vite/typedoc/index.ts:76 (suffixOf)
- scenario: TypeDoc writes `sources[].fileName` relative to its base path; a component outside that base (a monorepo run from one package with `entryPoints` reaching a sibling) is written `../other/src/Button.tsx`. `suffixOf` strips only a leading `./`, and `at.endsWith('/../other/src/Button.tsx')` is false for every absolute file, so `exportIn` finds nothing and the API panel loses descriptions, overloads and the page link. Stripping leading `../` segments before the suffix match (the suffix scoring already ranks ties) would keep them.
- evidence: read
- severity: low
- size: line
- cause: only `./` prefix normalized
- confidence: likely

## A merged interface's definition prints only its first declaration
- where: packages/forge/src/vite/typeDefs.ts:55 (addTypeDef)
- scenario: a project type `interface Theme { a: string }` augmented elsewhere with `interface Theme { b: number }` (declaration merging, common for theme/registry types). `getDeclarations().find(definedBy)` takes the first and prints it, so the API panel's definition of `Theme` shows `a` only while the props table (read from the checker) shows a prop typed `Theme` that also takes `b`. Every interface declaration should be printed, or the merged members shown.
- evidence: read
- severity: low
- size: function
- cause: first declaration taken as the whole type
- confidence: likely

## The workshop pages answer GET only, so a HEAD for `/` or `/frame.html` falls through to vite's 404
- where: packages/forge/src/vite/servePages.ts:27 (servePages middleware)
- scenario: `curl -I http://localhost:5173/` (or any health check / link checker using HEAD) reaches `next()` because `req.method === 'GET'` fails; forge's pages are virtual, so vite has no `index.html` to fall back to and answers 404 although a GET of the same URL is 200. HEAD should get the same status and headers without the body.
- evidence: read
- severity: low
- size: line
- cause: method check excludes HEAD
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

<!-- done: 5 findings, files read: 26 -->
