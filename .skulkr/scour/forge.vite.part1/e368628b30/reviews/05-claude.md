## A component whose props type is a union lists only the props every variant shares
- where: packages/forge/src/vite/apiTable.ts:45 (apiTable)
- scenario: a component declared `(props: { kind: 'a'; href: string } | { kind: 'b'; onPick: () => void })` → `checker.getPropertiesOfType(checker.getApparentType(props))` on a union returns only the properties common to every member, so the API table shows `kind` and drops `href` and `onPick`; it should list each variant's props (or the union of them, marked optional where a variant lacks them)
- evidence: read
- severity: medium
- size: function
- cause: getPropertiesOfType on a union type yields its common properties only
- confidence: likely

## `ownHost` refuses hosts vite's own host check lets through: `server.origin`, `hmr.host`
- where: packages/forge/src/vite/capture/endpoint.ts:118 (ownHost)
- fix: packages/forge/src/vite/issues/endpoint.ts
- scenario: a project sets `server.origin: 'http://dev.example.test:5173'` (or `server.hmr.host: 'dev.example.test'`) without `allowedHosts` and opens the workshop at that name → vite's host check passes it (vite adds server.host, hmr.host, the origin's hostname and preview.host to the allowed set), but `ownHost` only knows IPs, localhost, `server.host`, `allowedHosts` and the printed URLs, so `GET __forge/issues` answers 403 on a page vite serves. The docstring says it asks what vite asks; the two answers differ
- evidence: read (vite behavior from memory of its hostCheck's additional allowed hosts)
- severity: low
- size: function
- cause: partial copy of vite's allowed-host set
- confidence: likely

## The issues endpoint matches its path from `new URL(req.url, base)`, which reads a `//host/…` request path as a host
- where: packages/forge/src/vite/issues/endpoint.ts:150 (serveIssues middleware)
- scenario: a request for `//anything/__forge/issues?component=X` parses as host `anything`, pathname `/__forge/issues`, so the endpoint answers a path that is not its own, while the capture endpoint (`req.url.split('?')[0]`) would not — the same "is this request for me" decision answered two ways in two places
- evidence: read
- severity: low
- size: line
- cause: protocol-relative req.url parsed against a base URL
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

<!-- done: 3 findings, files read: 27 -->
