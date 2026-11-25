# Audit round 35 — apps.site

Note: the tree checked out here is HEAD 6636588122 (plus uncommitted changes); commit 197362e0 is not in this
repository's object store, so findings cite the working tree as found.

## A release whose entries fail to load shows "Loading…" forever, with an unhandled rejection
- where: apps/site/ReleaseSection.tsx:28 (useEntries)
- scenario: a reader opens a release after a deploy, so `release.load()`'s chunk is gone (or the fetch fails).
  `void release.load().then(...)` has no rejection handler: the promise rejects unhandled, `entries` stays
  null, and the section shows "Loading…" indefinitely. Nothing reaches `PageBoundary` either, so the
  missing-chunk reload (`reloadOnce`) never runs. `useSourceText` in WeaselDemos.tsx handles the same case with a
  `'failed'` state and a message; this path should do the same (or rethrow into the boundary).
- evidence: read
- severity: medium

## Seven shipping packages have no release-chip badge, and get the "no longer ships" fallback
- where: apps/site/releaseIcons.ts:6 (PACKAGE_ICONS)
- scenario: the Unreleased section lists changesets naming `export`, `paint-kinds`, `prefs-editor`,
  `prefs-schema`, `scale`, `text-tools` and `ui-canvas` (e.g. `.changeset/export-package.md`,
  `.changeset/scale-package.md`, `.changeset/ui-canvas-package.md`), all non-private packages under
  `packages/`. `PACKAGE_ICONS[name]` is undefined for each, so `chipIcon` renders their filter chips and entry
  chips with no icon — the case its doc reserves for "a package the history names but no longer ships". The
  table (and `icons/packages.mjs`) should cover every published package.
- evidence: read
- severity: low

## The Releases deep link scrolls again every time a filter change remounts its section
- where: apps/site/ReleaseSection.tsx:72 (ReleaseSection, `scrollTo`)
- scenario: open `?v=1.9.4#__releases`, then pick a package chip whose filter drops 1.9.4 from `shown`
  (Releases.tsx:83), then clear the filter. 1.9.4's section remounts (keyed by version), `target` is still
  `release.version === linked`, so `useState(target)` is true again and the page jumps back to 1.9.4 — and the
  section reopens even if the reader had closed it. The comment says "Only the version in the URL at mount is a
  deep link"; `linked` is read once per `Releases` mount but consumed on every section mount.
- evidence: read
- severity: low

## The release filter and `?v=` stay in the URL after leaving Releases, and re-apply on the next visit
- where: apps/site/Releases.tsx:31 (writeFilter) and :50 (`linked`)
- scenario: filter Releases to `core`, then open a demo from the sidebar. `open()` pushes `#<demo>` but the
  query keeps `?pkg=core` (and any `?v=`), so the demo page's URL carries the filter, and coming back to
  Releases from the sidebar later restores the old filter and scrolls to the old `?v=` version, though the
  reader navigated there fresh. Nothing clears the params on unmount.
- evidence: read
- severity: low

## The sidebar's home link replaces the current page's history entry instead of pushing one
- where: apps/site/WeaselDemos.tsx:96 (home link → `goFront`, apps/site/routes.ts:28)
- scenario: open demo A, then demo B from the sidebar (each pushes an entry, per the comment at
  WeaselDemos.tsx:58), then click the wordmark. `goFront` calls `replaceState`, so B's entry becomes the front
  page; Back from the front page goes to A, and B is lost from history. Every other in-app navigation pushes.
  `goFront`'s replace is right for its other caller (a hash that named nothing, line 69), not for a click.
- evidence: read
- severity: low

## In light mode the sidebar's active site-page link is near-white text on a pale tint
- where: apps/site/canvas-kit-demo.css:128 (`.ckd-nav-section a.active`) against :199/:211 (`.ckd-nav-whatsnew a`, `a.active`)
- scenario: the five site-page links (Get started, Releases, Packages, Demo updates, Canvas features) sit in a
  `<section class="ckd-nav-section ckd-nav-whatsnew">`, so both rule sets match them. `.ckd-nav-whatsnew a.active`
  (0,2,1, later) wins the background: `color-mix(accent-strong 30%, transparent)`. Its `color` is not restated,
  and `.ckd-nav-whatsnew a`'s `color: var(--wzl-fg)` is only (0,1,1), so `.ckd-nav-section a.active`'s
  `color: var(--wzl-fg-on-accent)` (0,2,1) applies. `--wzl-fg-on-accent` is `--wzl-gray-50` (#f5f5f6) in every mode
  (packages/theme/dist/tokens.css:136). In light mode that tint over `--wzl-surface-raised` (gray-100) is a pale
  lavender, so the open page's label reads at roughly 1.4:1. The rule meant for a solid accent fill has been applied
  to a 30% tint. `.ckd-nav-whatsnew a.active` should set its own `color` (e.g. `var(--wzl-fg)`).
- evidence: read
- severity: medium

## On a narrow viewport a new page doesn't start at its top
- where: apps/site/WeaselDemos.tsx:78 (scroll reset) with apps/site/canvas-kit-demo.css:601 (the `max-width: 880px` block)
- scenario: at ≤880px wide, the stylesheet makes `.ckd-app` the scrolling element (`overflow-y: auto`) and
  `.ckd-main` `overflow-y: visible`. The layout effect still zeroes `mainRef.current.scrollTop`, which does nothing
  now, so a reader who scrolls down a long demo and picks another page (from a link or the WhatsNew table) lands at
  the old scroll offset partway down the new page. The effect should reset whichever element actually scrolls.
- evidence: read
- severity: low

## `.ckd-demo`'s gap is declared twice with different values
- where: apps/site/canvas-kit-demo.css:142 and :482
- scenario: the main-pane block sets `.ckd-demo { gap: 18px }`; "Generic demo controls" redeclares `.ckd-demo` with
  `gap: var(--wzl-space-4)`, and the later one wins for every page. Editing the first rule (the one beside the page
  layout) has no effect. One of the two is dead.
- evidence: read
- severity: low

## The loupe-model description points to a demo by a title that doesn't exist
- where: apps/site/registry.ts:1366 (`loupe-model` description)
- scenario: the text says "The Loupe (hud window) and Loupe (lab capability) demos are painters over this same
  model". The labkit demo is titled "Loupe (labkit)" (registry.ts:872), so a reader searching the nav or the
  palette for "lab capability" finds nothing.
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
apps/site/PageBoundary.tsx
apps/site/Prose.module.css
apps/site/Prose.tsx
apps/site/ReleaseChipIcon.tsx
apps/site/ReleaseEntry.tsx
apps/site/ReleaseFilter.tsx
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
apps/site/icons/packages.mjs (header, helpers and the key list; the glyph bodies were not checked one by one)
apps/site/icons/planet.mjs
apps/site/isoDay.ts
apps/site/main.tsx
apps/site/registry.ts (all of it; its descriptions were spot-checked against code, not each one verified)
apps/site/releaseIcons.ts
apps/site/routes.ts
apps/site/testIcons.ts
apps/site/typography.css
apps/site/useVisiblePoll.ts

<!-- done: 9 findings, files read: 44 -->
