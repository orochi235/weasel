## An allowlisted response's several `Set-Cookie` headers collapse to the last one
- where: packages/forge/src/vite/capture/browser.ts:96 (passThrough)
- scenario: a capture page loads from an origin in `allowOrigins` whose response sets two cookies (two `Set-Cookie` headers). Node's `Headers` iterator yields each `set-cookie` as its own entry (the fetch spec leaves it out of comma-combining), and `Object.fromEntries` keeps only the last, so the page receives one cookie where a browser loading it directly would get both. A story whose allowlisted backend sets a session cookie plus another then renders differently in a capture than on screen. The fix is to join `response.headers.getSetCookie()` into the fulfilled headers the way Playwright accepts several values.
- evidence: read
- severity: low
- fix: packages/forge/src/vite/capture/browser.ts
- size: line
- cause: header multimap flattened through Object.fromEntries
- confidence: likely

## `isolate: undefined` on a story throws and drops the whole file from the index
- where: packages/forge/src/vite/indexFile.ts:197 (isolateOf)
- scenario: a story under an isolating meta writes `isolate: undefined` (or `parameters: { forge: { isolate: undefined } }`). `prop` returns the `undefined` Identifier, `stringOf` → `valueOf` finds no binding for it and answers undefined, so `isolateOf` throws `"<export>: isolate must be a string literal"`. `indexFile` rethrows, and every story in the file disappears from the workshop and from `forgeTest`, where the runtime would simply have read the story as not isolated, falling back to the meta's reason. The literal `undefined` (and `void 0`) should read as "not set" and fall through to `metaIsolate`, not as an unreadable value.
- evidence: read
- severity: low
- size: line
- cause: `undefined` identifier treated as a non-literal value
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
