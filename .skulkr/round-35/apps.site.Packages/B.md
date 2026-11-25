Note: the checkout's HEAD is 6636588122, not the 197362e015 the brief names; findings are against the tree as checked out.

## A transient HTTP error on the reference fetch is cached for the session as "has not been built"
- where: apps/site/Packages/reference/Reference.tsx:21 (loadReference)
- scenario: the static host answers `reference/geom.json` with a 502/503 once (deploy in progress, CDN hiccup). `fetched` maps `!response.ok` to `'unbuilt'`, the promise resolves, so `load.catch(() => pending.delete(name))` never runs and `pending` keeps the `'unbuilt'` result. Every later visit to any geom reference page in that tab says "The reference for @weasel-js/geom has not been built. `npm run build:api` writes it." until a full reload. The comment beside it says a failed fetch is not remembered, and `Loading` has a 'failed' state with "Reload the page to try again" for exactly this. Only a 404 (or the dev server's HTML fallback) means unbuilt; a 5xx should reject (not cached, shows the failed note).
- evidence: read
- severity: low

## Guide body looked up through the prototype chain
- where: apps/site/Packages/Guides.tsx:36 (Guides)
- scenario: `loaded.guides` is a plain object built with `Object.fromEntries` (scripts/vite-package-docs.ts:117), keyed by guide slugs taken from file names. A package with `docs/guides/constructor.md` (or `toString.md`, `valueOf.md`, `01-hasOwnProperty.md`) — its own key wins there, but if the doc and info disagree (e.g. the loaded doc lacks the slug because of the duplicate case below, or a stale HMR doc) `loaded.guides['constructor']` returns `Object.prototype.constructor`, a function; `?? []` does not catch it and `Prose` receives a function as `blocks` and throws. The lookup should be `Object.hasOwn(loaded.guides, slug) ? … : []`.
- evidence: read
- severity: low

## Two guide files with the same slug show one guide's title over the other's body
- where: apps/site/Packages/Guides.tsx:12 and :36 (Guides)
- scenario: slugs strip a numeric prefix (`01-setup.md`, `setup.md`, or `01-setup.md` and `02-setup.md` both give `setup`). `pkg.guides` holds both; `find` picks the first, so the heading is the first file's title, while `loaded.guides` (fromEntries) keeps the last file's body. The guide list renders two links to the same address with duplicate React keys, both marked `aria-current`, and the first file's body is unreachable. Nothing on the page side detects the clash.
- evidence: read
- severity: low

## A name that is both a type and a value gets the first declaration's summary and deprecation in every group
- where: apps/site/Packages/reference/ModuleIndex.tsx:9 and :32-42 (ModuleIndex)
- scenario: `export const Foo = …` plus `export type Foo = …` appear under TypeDoc's "Variables" and "Type Aliases" groups (scripts/lib/reference/project.ts:160 keeps both). `byName` keeps only the first symbol named `Foo`, so both rows show the variable's summary, and if only the type is `@deprecated` neither row is struck (or, if only the variable is, the type row is struck too). The row in each group should read the declaration of that group's kind, or the strike should require every declaration to be deprecated.
- evidence: read
- severity: low

## A root export named like one of the package's subpath entries has an unreachable page
- where: apps/site/Packages/reference/ReferenceView.tsx:13 (ReferenceView); link written at apps/site/Packages/reference/ModuleIndex.tsx:36
- scenario: ModuleIndex links a root-entry export `react` (or `mesh`, `icons`, `engine`…) to `symbolRoute(pkg, '', 'react')` = `pkg/<pkg>/reference/react`. ReferenceView resolves that through `splitReferencePath`, which sees `react` in the module list and returns the `./react` module's index. The export's own page cannot be opened; the link in the index silently goes to a different page. No current package collides (checked package exports against root exports), but the two sides answer the same address two ways.
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

<!-- done: 5 findings, files read: 18 -->
