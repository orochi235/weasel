## exportIn takes another package's component when it is the only suffix match, so a component TypeDoc does not document shows a namesake's docs
- where: packages/forge/src/vite/typedoc/index.ts:92 (exportIn)
- scenario: monorepo TypeDoc JSON with per-package paths (`src/Button.tsx`); package `b` documents `Button` at `src/Button.tsx`, package `a` has its own `Button` at `packages/a/src/Button.tsx` that TypeDoc does not document. `exportIn(index, 'Button', '/repo/packages/a/src/Button.tsx')` scores b's export (suffix `/src/Button.tsx` matches), `found.length === 1`, and returns it: a's API panel gets b's descriptions, defaults, deprecations, overloads and href. The package check that the doc comment describes runs only when two or more match; it should also reject a single match whose module is not `file`'s package (when the module names are package names).
- evidence: read
- severity: medium
- fix: packages/forge/src/vite/typedoc/index.ts
- size: function
- cause: package disambiguation applied only to ties
- confidence: likely

## typedoc/index.ts carries its own copy of packageNameOf beside packageName.ts's
- where: packages/forge/src/vite/typedoc/index.ts:102 (packageNameOf)
- scenario: "which package is this file in" is answered by `packages/forge/src/vite/packageName.ts` (used by apiTable.ts and history.ts) and again by a private `packageNameOf` here, with a different signature (dir vs file, `undefined` vs `null`, no `top` bound). A fix to one (e.g. bounding the climb, caching) does not reach the other, so the API table's package label and the TypeDoc lookup can disagree.
- evidence: read
- severity: low
- fix: packages/forge/src/vite/typedoc/index.ts
- size: line
- cause: duplicated lookup
- confidence: sure

## servePages answers only GET, so a HEAD for the workshop or frame page falls through to vite and is not the page
- where: packages/forge/src/vite/servePages.ts:27 (servePages middleware)
- scenario: `curl -I http://localhost:5173/frame.html` (or a readiness probe using HEAD on `/`): `req.method === 'GET'` fails, `next()` hands it to vite's own html middleware, which has no `frame.html` / virtual index on disk and answers 404 (or the root index.html), while GET on the same URL is 200 with forge's page. HEAD should get the same status and headers as GET.
- evidence: read
- severity: low
- size: line
- cause: method check excludes HEAD
- confidence: likely

## typeText prints a template literal type without escaping backticks or `${` in its text parts
- where: packages/forge/src/vite/typedoc/print.ts:39 (typeText, case 'templateLiteral')
- scenario: a prop typed `` `a\`b${string}` `` (or with a literal `${` written `\${`): TypeDoc's `head`/`tail` hold the cooked text with a bare backtick, and the printed signature is `` `a`b${string}` ``, which is not valid TypeScript and misreads as two types. `head` and each tail text need `` ` ``, `\` and `${` escaped as `literalText` does for string literals.
- evidence: read
- severity: low
- size: line
- cause: unescaped template text
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
