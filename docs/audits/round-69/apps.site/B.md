# Audit round 69 — apps.site

## Release chips look up package badges with a prototype-chain index on a changelog-keyed table
- where: apps/site/ReleaseEntry.tsx:31 (ReleaseEntry), apps/site/ReleaseFilter.tsx:35 (ReleaseFilter)
- scenario: `PACKAGE_ICONS[name]` indexes a plain object literal with a package name read from the changelogs. A name that matches an `Object.prototype` member (`constructor`, `toString`, `__proto__`…) gets a function back. `chipIcon` treats that as truthy and hands it to `<Icon name>` as an `IconRef`, where it should get no icon, as an unknown package does. `apps/site/__tests__/releaseIcons.test.ts:19` answers the same question with `hasOwnKey`, so the page and its test disagree on what "has a badge" means.
- evidence: read
- severity: low

## Moving between the two release pages from the sidebar keeps `?v=`, and the stale version then reroutes the page
- where: apps/site/ReleaseHistory.tsx:127-132 (ReleaseHistory unmount cleanup), with apps/site/routes.ts:38 (releasesRouteFor) and apps/site/WeaselDemos.tsx:61 (open)
- scenario: open `?v=0.9.3#__older_releases`. The older page keeps `v=0.9.3` in the URL while it is shown. Click "🏷️ Releases" in the sidebar. `open()` pushes `#__releases` with the query unchanged. The unmount cleanup sees a release page in the hash and writes nothing, so `v` survives. The new `ReleaseHistory` then reads `0.9.3` as its own version and keeps writing it back (`writeParams(filter, version)`). The address bar now reads `?v=0.9.3#__releases`. Reloading it, sharing it, or any later `readHash` sends `releasesRouteFor` to `__older_releases`, so the reader lands on the page they just left. The footer link does the same move through `openReleasesPage`, which deletes `VERSION_PARAM` on purpose ("keeping the filter but not the version"). One move gets two answers: the cleanup should clear the version and keep only the filter when the next page is the other release page.
- evidence: read
- severity: medium

## The DevtoolsSplit browser-test stylesheet models a 280 px sidebar; the site's is 240 px
- where: apps/site/DevtoolsSplit.browser.module.css:1-6 (.main)
- scenario: the fixture claims to be "the site's main pane at 1440×900: the viewport less its 280 px sidebar" and pins `.main` at `left: 280px; width: 1160px`. `apps/site/canvas-kit-demo.css:20` sets `.ckd-app { grid-template-columns: 240px 1fr; }`, so the real pane at 1440 px is 1200 px wide and starts at 240. The browser test of the split's sticky panel and column narrowing measures a pane 40 px narrower than the one readers get. A layout that only fits, or only overflows, in the real width passes or fails for the wrong reason.
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
apps/site/registry.ts
apps/site/releaseIcons.ts
apps/site/routes.ts
apps/site/testIcons.ts
apps/site/typography.css
apps/site/useVisiblePoll.ts

<!-- done: 3 findings, files read: 46 -->

