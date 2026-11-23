# forge.vite — reviewer findings (round 79)

## Story ids are built from the raw export name, so they disagree with Storybook's for any camelCase export, and a meta's `id` is ignored
- where: packages/forge/src/vite/indexFile.ts:153 (indexProgram)
- scenario: `export const LoggedIn = {}` under title `Example/Page`. forge indexes it as `example-page--loggedin`; Storybook's `normalizeStory`/CsfFile build `toId(meta.id || meta.title, storyNameFromExport(key))`, giving `example-page--logged-in`. A meta with `id: 'custom'` gets `custom--…` in Storybook and the title-based id here. `ids.ts` states its port "must agree or links diverge", and `autoTitle.ts` says the same of titles, so every link or bookmark shared between forge and Storybook for a multi-word export breaks. (`ids.test.ts` asserts `'ui-slider--withname'`, so the test enshrines the divergence; the same call shape is in `loadCsfModule.tsx:206` and `story/native.ts:20`, outside this area.)
- evidence: read (forge side); Storybook side from its source as recalled, not run here
- severity: medium

## `tags`, `includeStories`/`excludeStories` and `viewport`'s sides are read only when written inline, unlike every other meta field
- where: packages/forge/src/vite/indexFile.ts:213 (viewportOf), :220 (tagsOf), :239 (storyFilter)
- scenario: `const HIDDEN = ['Helper']; export default { title: 'X', excludeStories: HIDDEN }`, or `tags: TAGS`, or `viewport: { width: W, height: 400 }` with `const W = 320`. `title`, `name`, `isolate` and `parameters` all go through `stringOf`/`objectOf`, which follow top-level `const`s, but these three check the node's own type (`ArrayExpression`, `RegExpLiteral`, `NumericLiteral`). So the index lists `Helper` as a story the loader then excludes, drops the meta's tags (the `!tag` removals and gallery/test tags with them), and loses the viewport. Same field, answered one way for title and another way here.
- evidence: read
- severity: low

## An SSH host alias of the common `github.com-<account>` form is taken as a GitHub Enterprise host, so the issues panel errors instead of listing
- where: packages/forge/src/vite/issues/endpoint.ts:44 (repoOf)
- scenario: `origin` is `git@github.com-work:owner/repo.git` (the usual `~/.ssh/config` alias for a second account). `rawHost.endsWith('.github.com')` is false, so `ghRepo` becomes `github.com-work/owner/repo` and the page URL `https://github.com-work/owner/repo`; `gh issue list -R github.com-work/owner/repo` fails, and the endpoint answers 502 with gh's error and a dead repo link. Only the `<x>.github.com` alias form is recognized.
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
packages/forge/src/vite/history.ts
packages/forge/src/vite/html.ts
packages/forge/src/vite/index.ts
packages/forge/src/vite/indexFile.ts
packages/forge/src/vite/indexStory.ts
packages/forge/src/vite/isolateReport.ts
packages/forge/src/vite/issues/answer.ts
packages/forge/src/vite/issues/endpoint.ts
packages/forge/src/vite/moduleInfo.ts
packages/forge/src/vite/nativeExports.ts
packages/forge/src/vite/ownEntries.ts
packages/forge/src/vite/ownKeys.ts
packages/forge/src/vite/plugin.ts
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

<!-- done: 3 findings, files read: 50 -->
