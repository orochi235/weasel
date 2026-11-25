## forgeTest registers a story file's tests again inside every test file that imports it
- where: packages/forge/src/vite/forgeTest.ts:44 (transform)
- scenario: `transform` appends `__forge_test(...)` calls to every module whose id matches the story globs, not only to the module vitest loads as the test file. A story file that imports another (`import * as Base from './Button.stories'`, a common way to reuse args) evaluates the imported file's appended code while the importing file is being collected, so vitest registers the imported file's stories as tests of the importing file too. Every such story then runs twice (once per file), and a failure in it shows up under the wrong file. Only the test entry should register tests; an imported story module should be left alone.
- evidence: read
- severity: medium

## repoOf takes any git host for GitHub, so a GitLab or Bitbucket origin reports a `repo` and a misleading reason
- where: packages/forge/src/vite/issues/endpoint.ts:53 (repoOf), used at :111 (serveIssues answer)
- scenario: origin `git@gitlab.com:team/app.git` → repoOf returns `{ slug: 'team/app', url: 'https://gitlab.com/team/app', ghRepo: 'gitlab.com/team/app' }`. `IssuesAnswer.repo` is documented as "Null when `origin` names no GitHub repository", yet it holds a GitLab URL, and the "origin is not a GitHub repository" answer is never given. Instead `gh issue list -R gitlab.com/team/app` runs and fails, and the page shows either "gh is not logged in. Run gh auth login" (gh asks to log in to the unknown host) or a 502 with gh's stderr. Every non-github.com host is treated as GitHub Enterprise with no check.
- evidence: read
- severity: low

## componentOf drops everything past the second segment of a dotted component name
- where: packages/forge/src/vite/bindings.ts:103 (componentOf)
- scenario: `indexFile` records `componentName` through `dottedName`, which keeps any depth (`Menu.Item.Icon`). `componentOf` does `local.split('.')` and destructures only `[root, member]`, so `component: Menu.Item.Icon` resolves the binding for `Menu.Item`. The graph then credits `Item`'s source and uses to that title, when it should resolve the full chain or return null.
- evidence: read
- severity: low

## fileDates misses files whose paths git still quotes with core.quotepath=off
- where: packages/forge/src/vite/history.ts:12 (runGit), :44 (fileDates)
- scenario: `core.quotepath=off` only stops octal-escaping bytes above 0x80. A path containing a double quote, a backslash, a tab or a newline is still printed C-quoted (`"a\"b.tsx"`) by `git log --name-status`, so `names.get(name)` never matches and that component shows no history. `-z` output (or unquoting) would handle every path.
- evidence: read
- severity: low

## bindingsOf treats a top-level `let` as reassigned when an inner scope assigns its own variable of the same name
- where: packages/forge/src/vite/ast.ts:52 (assignedNames), used at :33 (bindingsOf)
- scenario: `assignedNames` walks the whole program and collects every assigned identifier with no regard to scope. `let Primary = story({...})` at top level plus `function f() { let Primary; Primary = 1; }` anywhere in the file → `Primary` counts as reassigned, so its binding becomes the declarator rather than the `story(...)` call, and `calleeOf`/`objectOf`/`isLiteralValue` can no longer read it (story options such as `name`, `isolate` and `tags` are missed). Only assignments that resolve to the top-level binding should count.
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

<!-- done: 5 findings, files read: 27 -->
