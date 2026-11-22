# Audit round 69 — apps.site — reviewer findings

## Back/Forward between the two release pages rewrites the destination entry's query with the departing page's filter and version
- where: apps/site/ReleaseHistory.tsx:120 (ReleaseHistory, `useWindowEvent('popstate', …)` with the `writeParams` effect at :122 and the unmount cleanup at :127)
- scenario: Open `?v=2.1.0&pkg=text-tools#__releases` (a current-major version and a package that only appears in current-major entries), then click the footer link "Releases before 2.0 →". `openReleasesPage` pushes `?pkg=text-tools#__older_releases`, and OlderReleases mounts. Press Back. The browser restores the Releases entry's URL and fires `popstate` synchronously, before the queued `hashchange`. The still-mounted OlderReleases handles it: `readFilter(known)` prunes `text-tools` against the *older* page's package set, `setFilter` re-renders it (popstate is a discrete event, so React commits and flushes the passive effect right away), and `writeParams(filter, version)` calls `replaceState` on the *Releases* entry with no `pkg` and OlderReleases' own `version` (null), deleting `v=2.1.0`. Then `hashchange` arrives and Releases mounts. OlderReleases' unmount cleanup deliberately skips clearing the query because the new hash is a releases page. Releases then reads a URL that has lost both its package filter and its deep link. Forward does the same in reverse: Releases writes its `version` into the Older entry, so that page shows `?v=2.x` and a reload routes it to Releases through `releasesRouteFor`. Expected: the departing page's popstate handler should not write the arriving entry's query (for example, by ignoring popstate when the hash is no longer this page's, or by re-reading `version` too); the arriving page should get the URL as it was.
- evidence: read (event ordering inferred from the HTML history-traversal spec and React's discrete-event effect flush; not run)
- severity: medium

## A failed fetch of the highlighter chunk takes the whole demo page down instead of the code panel
- where: apps/site/WeaselDemos.tsx:181 (DemoView, `<Suspense>` around the lazy `SourceView`)
- scenario: A tab opened before a deploy scrolls to the code panel. `import('./SourceView')` rejects with a chunk-load error. The only boundary above it is the page's `PageBoundary` (:119), so the running demo canvas is unmounted and replaced by "This page could not load its code". If `reloadOnce` already fired in the last 30 s, the reader is left with no demo at all. That happens even though `useSourceText` (:144) already has a scoped "This file could not be loaded" state for a failed source fetch. Expected: a failed highlighter load should degrade the panel the same way a failed text load does (plain `<pre>`, or the panel's failed message), leaving the demo running.
- evidence: read
- severity: low

## Files read
apps/site/App.tsx
apps/site/CommandPalette/SitePalette.tsx
apps/site/DemoDevtools.module.css
apps/site/DemoDevtools.tsx
apps/site/DemoFrame.tsx
apps/site/DevtoolsSplit.browser.module.css
apps/site/DevtoolsSplit.tsx
apps/site/Features/Features.module.css
apps/site/Features/Features.tsx
apps/site/OlderReleases.tsx
apps/site/PageBoundary.tsx
apps/site/Prose.module.css
apps/site/Prose.tsx
apps/site/ReleaseChipIcon.tsx
apps/site/ReleaseEntry.tsx
apps/site/ReleaseFilter.tsx
apps/site/ReleaseHistory.tsx
apps/site/ReleaseSection.tsx
apps/site/Releases.css
apps/site/Releases.tsx
apps/site/Shell.tsx
apps/site/SiteNav.tsx
apps/site/SiteThemeProvider.tsx
apps/site/SourceView.tsx
apps/site/WeaselDemos.tsx
apps/site/WhatsNew.module.css
apps/site/WhatsNew.tsx
apps/site/canvas-kit-demo.css
apps/site/canvasBackend.ts
apps/site/chunkReload.ts
apps/site/colorMode.ts
apps/site/icons.gen.ts
apps/site/icons.table.ts
apps/site/icons/frame.mjs
apps/site/icons/index.mjs
apps/site/icons/kinds.mjs
apps/site/icons/packages.mjs
apps/site/icons/planet.mjs
apps/site/isoDay.ts
apps/site/main.tsx
apps/site/releaseIcons.ts
apps/site/routes.ts
apps/site/testIcons.ts
apps/site/typography.css
apps/site/useVisiblePoll.ts

<!-- apps/site/registry.ts read only in part: lines 1–200 and 1740–1776 (the types and every line of logic), plus every id and path line through Grep; the demo descriptions in the middle were spot-checked against the exports they name, not read end to end. -->

<!-- done: 2 findings, files read: 45 -->
