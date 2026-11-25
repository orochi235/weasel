# Audit round 87 — forge.vite.part1

## The API table's component and the dependency graph's component are read through different calls
- where: packages/forge/src/vite/componentOf.ts:93 (objectOf), compared with packages/forge/src/vite/ast.ts:280 (objectOf) as indexFile.ts:180 uses it
- scenario: a story file writes `export default defineMeta({ component: Button })`, where `defineMeta` is a project helper that does not resolve to forge's `meta`. The TypeScript `objectOf` unwraps any call's first argument (`if (tsm.isCallExpression(node)) node = node.arguments[0]`), so `componentOf`/`metaComponentOf` find `Button`. The babel `objectOf` the indexer uses unwraps only `wrappers` callees, so `prop(meta, 'component')` reads nothing, `componentName` is unset, and `bindings.componentOf` falls back to the title's last segment. When the title is not `…/Button`, the dependency graph keys a different component, or none, than the one the API table and args read. `componentOf`'s doc says it picks the component "as the dependency graph picks it". `componentIn`'s spread handling has the same split: it says it reads a spread "as the story indexer takes it", but it follows spreads through any call. The question of which object a meta is gets answered two ways.
- evidence: read
- severity: medium

## The issues endpoint runs `gh` and `git` with no timeout
- where: packages/forge/src/vite/issues/endpoint.ts:16 (runGh), and runGit at packages/forge/src/vite/history.ts:10
- scenario: `gh issue list` stalls (network down, proxy hanging, a credential helper waiting on input). `execFile` is given no `timeout`, so the request never answers and its child process stays alive. Every page load or refetch of a component's issues spawns another one, so stalled `gh` processes and open responses build up with no bound. A bounded `timeout` that maps to an `error` answer would end each one.
- evidence: read
- severity: low

## freeNames drops every value reference inside a TS enum or namespace
- where: packages/forge/src/vite/freeNames.ts:96 (walk)
- scenario: `if (n.type.startsWith('TS') && !('expression' in n)) return;` returns on `TSEnumDeclaration` and `TSModuleDeclaration`. A helper written as `namespace Parts { export const Icon = () => <Glyph/> }` or `enum E { A = compute() }` therefore reports no reference to `Glyph` or `compute`. Any component reached only through such a body drops out of the component graph's `uses`. Only type positions are meant to be skipped.
- evidence: read
- severity: low

## The component graph sorts titles one way and `uses`/`usedBy` another
- where: packages/forge/src/vite/componentGraph.ts:108-112 (build)
- scenario: `node.uses = [...uses].sort()` and `node.usedBy.sort()` sort by UTF-16 code unit, while the graph's own keys are sorted with `localeCompare`. Take titles `ui/button` and `ui/Card`: the graph lists `ui/button` before `ui/Card`, while a `uses` list holding both gives `ui/Card` first. Any panel that shows both lists orders the same titles two ways.
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

<!-- done: 4 findings, files read: 27 -->
