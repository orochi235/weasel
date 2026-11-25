## refOf lists every DOM member when a ref holds an intersection with a platform type
- where: packages/forge/src/vite/apiTable.ts:149 (refOf)
- scenario: a component whose `ref` is `Ref<HTMLDivElement & { reset(): void }>`. `held` is an intersection, so `held.getSymbol()` and `held.aliasSymbol` are both undefined and `declared` is `[]`. `[].every(...)` would be true, but the `declared.length > 0` guard makes the platform short-circuit fail, so `getPropertiesOfType(held)` enumerates the several hundred `HTMLDivElement` members. Each one becomes a `members` row and goes through `define`. The result should be what happens when `HTMLDivElement` is held alone: no platform members, only the component's own `reset`. The same happens for any held type with no single symbol whose parts are all platform types.
- evidence: read
- severity: low

## autoTitle keeps a `.` segment for a file outside root that no glob matches
- where: packages/forge/src/vite/autoTitle.ts:36 (titleFrom via autoTitle's no-match branch)
- scenario: `autoTitle('/repo/x/Foo.stories.tsx', '/repo/app', [...])` with no matching glob. `path` is `../x/Foo.stories.tsx` and `dotted` leaves it alone. `titleFrom(importPath, '.')` runs `importPath.replace('.', '')`, which strips only the first character and gives `./x/Foo.stories.tsx`. Splitting that and filtering out empty strings keeps `.`, so the title is `./x/Foo`. It should be `x/Foo`, or `../x/Foo` with its segments intact. Inside root the same replace removes the `.` of `./` and works, so the bug only shows outside it.
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

<!-- done: 2 findings, files read: 26 -->
