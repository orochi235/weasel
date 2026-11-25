I couldn't write `.skulk/out/findings.md` because the write permission was refused, so the whole document is below.

# Audit round 40 — apps.site

## The Canvas features table lists a preset's tool set by the set's id, not the tools it mounts
- where: apps/site/Features/Features.tsx:12 (`toolName`), :44 (`PresetRow` Tools column)
- scenario: `FEATURE_PRESETS['tools:shape'].tools` is `[SHAPE_TOOLS]`, a `ToolSet` built by `toolSet('shape', kitShapeKindsOf('shape'))`. `toolName` returns `t.id` for any object that has an `id`, so the row's Tools column shows one entry, `shape`, which is not a tool id at all. The rect, ellipse, etc. tools the preset actually mounts never appear. The same happens for `tools:select` (`select`, the set's id, hides the other members) and for `tools:view`. The page's own prose says a canvas registers "the … tools … of every preset it is given", so the column should expand a set into its member ids (`toolIdsOf` in routing).
- evidence: read (packages/routing/src/tools/toolSet.ts:26-35, packages/editing/src/tools/toolSets.ts:8-10, packages/editing/src/presets/tools.ts:62-68)
- severity: low

## A `?pkg=` the history never names filters Releases to nothing, and no chip shows it is set
- where: apps/site/Releases.tsx:23-29 (`readFilter`)
- scenario: open `?pkg=old-name#__releases` (a package since renamed or dropped, or a typo in a shared link). Tags read from the URL are checked against `TAGS`, but packages are taken as given. `matches` then fails every entry, so the page says "No changes match that filter" and the summary reads "0 changes in old-name". `packageCounts` has no chip for `old-name`, so the reader can't see or un-toggle it; only All clears it. Packages should be filtered against the names the history carries (`packageCounts`), the same way tags are.
- evidence: read (Releases.tsx:26-27, ReleaseFilter.tsx:29-40, apps/shared/releases.ts:137-145)
- severity: low

## The sidebar never marks a package page as the active one
- where: apps/site/SiteNav.tsx:46-52 (package heading links)
- scenario: open `#pkg/geom` from the sidebar's `geom` heading. `NavLink` gives the current page's link `className="active"`, but the package heading is a bare `<a>` with no active check against `packageRoute(pkg)`, and the `📦 Packages` link is active only for `pkg` itself. So on any package page, or any of its tabs, nothing in the nav is highlighted, while every other page the sidebar links to is.
- evidence: read
- severity: low

## typography.css puts the Demo updates table's headers in the UI face through a class nothing renders any more
- where: apps/site/typography.css:10 (`.ckd-whatsnew-table th`)
- scenario: open `#__whats_new`. `WhatsNew` renders `<DataGrid className={s.grid}>` (a CSS-module class), and no file in apps/ emits `ckd-whatsnew-table`; DataGrid's stylesheet sets no `font-family`. So the table's `th` cells inherit `body { font-family: var(--wzl-font-body) }` instead of the `--wzl-font-ui` this rule puts them in, alongside the sidebar, eyebrow and release chrome. The selector should name the grid the page actually renders, or be dropped.
- evidence: read (grep for `ckd-whatsnew-table` across apps/ matches only typography.css; WhatsNew.tsx:56)
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

Coverage notes:
- **registry.ts:** I read its types, its derivation code, and every entry's id, placement, load target and path. All 180 load/path pairs agree. I did not check each entry's description against the demo it describes.
- **packages.mjs:** I read its code (`slider`, the imports, the computed bodies) but did not audit the hand-written path data of each glyph.
- **Release history:** the sandbox blocked `git log`/`git show`, so I couldn't check which of these files changed in the last week.

<!-- done: 4 findings, files read: 44 -->