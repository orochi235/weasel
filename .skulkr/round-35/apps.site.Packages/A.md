## A reference fetch that answers non-OK is cached for the session as "not built", so a 5xx or a later `build:api` is never retried
- where: apps/site/Packages/reference/Reference.tsx:23 (loadReference)
- scenario: the server answers `reference/geom.json` with a transient 500/503 (or 404 before `npm run build:api` has run in dev). `fetched` maps any `!response.ok` to `'unbuilt'`, the promise resolves, and `pending` keeps it — only a *rejected* fetch is evicted (line 32). The page then says "The reference for @weasel-js/geom has not been built. `npm run build:api` writes it." for a server error, and after the reader runs `build:api` as told and navigates to another package and back, the cached `'unbuilt'` is served again until a full reload. Should: treat only a 404 (or an HTML fallback) as unbuilt, and not memoize the `'unbuilt'` outcome (evict it like a rejection) so reopening the page refetches, as the comment on line 31 intends for failures.
- evidence: read
- severity: low

## The export index shows the first same-named declaration's summary and deprecation under every group that lists the name
- where: apps/site/Packages/reference/ModuleIndex.tsx:9 (ModuleIndex, `byName`)
- scenario: a module exports `const Foo` (deprecated, summary "Old factory") and `interface Foo` (not deprecated, summary "The shape of a Foo"). TypeDoc lists `Foo` under both "Variables" and "Interfaces". `byName` keeps one symbol per name (the first, via the reversed Map entries), so the "Interfaces" row is struck through and captioned with the variable's summary. ReferenceView (line 19) already acknowledges that a type and a value may share a name and shows both on the symbol page; the index answers the same question differently. Should: pick the symbol per group by the group's kind (or match on name and kind), so each row describes the declaration it lists.
- evidence: read
- severity: low

## Two destructured parameters in one signature get the same React key in CallDetails
- where: apps/site/Packages/reference/Callable.tsx:11 (CallDetails)
- scenario: a function `f({ a }: A, { b }: B)` — TypeDoc names both parameters `__namedParameters`, and `parameterName` (scripts/lib/reference/types.ts:255) rewrites both to `options`. CallDetails keys each row by `param.name`, so both rows get key `options`: React logs a duplicate-key error and may reuse or drop a row on re-render (e.g. moving between overloads of the same name on the page). Should: key by index (the list is static per signature) or name+index.
- evidence: read
- severity: low

## Files read
apps/site/Packages/Guides.tsx
apps/site/Packages/Loading.tsx
apps/site/Packages/Overview.tsx
apps/site/Packages/PackageDemos.tsx
apps/site/Packages/Packages.module.css
apps/site/Packages/Packages.tsx
apps/site/Packages/catalog.ts
apps/site/Packages/reference/Callable.tsx
apps/site/Packages/reference/ClassPage.tsx
apps/site/Packages/reference/CodeLine.tsx
apps/site/Packages/reference/FunctionPage.tsx
apps/site/Packages/reference/Members.tsx
apps/site/Packages/reference/ModuleIndex.tsx
apps/site/Packages/reference/Reference.module.css
apps/site/Packages/reference/Reference.tsx
apps/site/Packages/reference/ReferenceView.tsx
apps/site/Packages/reference/TypePage.tsx
apps/site/Packages/useLoaded.ts

<!-- done: 3 findings, files read: 18 -->
