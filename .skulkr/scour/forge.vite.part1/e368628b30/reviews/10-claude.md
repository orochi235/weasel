## A `deps.js` build that finishes after a concurrent rebuild serves and records a stale graph
- where: packages/forge/src/vite/depsFeed.ts:96 (createDepsFeed → module)
- scenario: `depsSent` is already set (a page has loaded `deps.js` once). A second tab opens, or the page re-imports `deps.js` after `invalidateVirtual`, so `module()` starts and reads the component files. An edit lands while it runs. Because `depsSent !== null`, `redeps` starts `rebuild` right away instead of queuing it in `editedWhileServing`. If `rebuild` finishes first, it pushes the new graph and sets `depsSent`. Then `module()` finishes, overwrites `depsSent` with the graph it built before the edit, and returns that to the page as its module. The page keeps the old graph, and the next comparison runs against the stale `depsSent`, until another edit lands. What should happen: an edit landing during `module()` always triggers a rebuild after it, or `module()` drops a result older than the last push.
- evidence: read
- severity: low
- fix: packages/forge/src/vite/depsFeed.ts
- size: function
- cause: `editedWhileServing` is only set when nothing was sent; the serve and the rebuild race on `depsSent`
- confidence: likely

## The SSH alias `github-work` is read as a GitHub Enterprise host
- where: packages/forge/src/vite/issues/endpoint.ts:62 (repoOf)
- scenario: the remote is `git@github-work:owner/repo.git`, a common `~/.ssh/config` alias convention. The github.com test `^(?:[\w-]+\.)*github\.com(?:[-_][\w-]+)?$` needs a literal `github.com`, so `host` stays `github-work`. `ghRepo` then becomes `github-work/owner/repo`, and gh fails on the unknown host. The panel shows an error (502), or "not logged in" if gh says to run `gh auth login`, where it should list the github.com issues. The doc promises that a host "named for" github.com counts, but only the `github.com-work` and `work.github.com` spellings are accepted.
- evidence: read
- severity: low
- size: line
- cause: alias pattern only accepts a `github.com` stem
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
