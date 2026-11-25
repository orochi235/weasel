I read 40 of the area's 44 files and found 4 low-severity defects. Only the first finding reached `.skulk/out/findings.md`: writes to it were refused for permissions after that, so the full document is below. Nothing else was edited.

# Audit round 40: apps.site findings

## The canvas features page credits core with presets that now live in @weasel-js/editing
- where: apps/site/Features/Features.tsx:51,59 (Features)
- scenario: Commit 964a242853 (2026-11-16) moved the presets to `@weasel-js/editing`. The page now lists `FEATURE_PRESETS` from `@weasel-js/editing` and points readers to `presets.pick` / `presets.draw` from `@weasel-js/editing/presets`. Its docstring and first sentence still say "What each of core's presets turns on". A reader who looks in `@weasel-js/core` for `pick`/`draw` finds only `view`/`viewTools`. The text should say editing's presets; core supplies only the "every canvas" baseline row.
- evidence: read
- severity: low

## The demo updates table's headers lost the UI font: typography.css still targets a class nothing renders
- where: apps/site/typography.css:10 (`.ckd-whatsnew-table th`), apps/site/WhatsNew.tsx:56 (WhatsNew)
- scenario: Commit 0233183184 rebuilt the "Demo updates" page on ui's `DataGrid` with `className={s.grid}`. No element carries `ckd-whatsnew-table` any more; a grep of apps/ finds it only in typography.css. `DataGrid.module.css` sets no `font-family`. So the column headers ("Demo", "Filed under", "Created", "Last modified") inherit the body font from `body`. typography.css says those headers should use `--wzl-font-ui`, like the sidebar, the eyebrow and the release chrome. The fix is to point the rule at the grid WhatsNew renders (for example `.grid th` in WhatsNew.module.css), or delete it if the body font is now wanted.
- evidence: read
- severity: low

## Prose keeps its own copy of "which fence languages CodeBlock can color", and it has drifted
- where: apps/site/Prose.tsx:6 (`HIGHLIGHTED`)
- scenario: The comment says the set is "The fence languages `CodeBlock` can color". `CodeLanguage` (packages/ui/src/components/CodeBlock/CodeBlock.tsx:7) also accepts `typescript`, `javascript`, `markup`, `markdown` and `md`, and Prose leaves all of those as a plain `<pre>`. An `html` fence is never mapped to `markup` either. So the ```` ```html ```` block in packages/theme/README.md:31 (`<html data-wzl-mode="light">`) shows uncolored on its package page, and so would any README fence written as `typescript`/`javascript`. The fix is to derive the set from CodeBlock's own list and map common aliases such as html → markup.
- evidence: read
- severity: low

## The same demo's last-modified date is shown by UTC day on one page and by local time on another
- where: apps/site/WhatsNew.tsx:15 (DateCell → `isoDay`), apps/site/WeaselDemos.tsx:39-47 (`formatRelativeOrIso`)
- scenario: Take a demo whose `lastModified` is `2026-10-31T22:00:00-05:00`. "Demo updates" shows `2026-11-01`, because `isoDay` takes the UTC day. That demo's own page shows "last modified Oct 2026" to a US reader, because `toLocaleDateString` uses local time. Near a day or month boundary, the two pages disagree about when the demo changed. One date rule should serve both.
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
apps/site/icons.table.ts
apps/site/icons/frame.mjs
apps/site/icons/index.mjs
apps/site/icons/kinds.mjs
apps/site/isoDay.ts
apps/site/main.tsx
apps/site/releaseIcons.ts
apps/site/routes.ts
apps/site/testIcons.ts
apps/site/typography.css
apps/site/useVisiblePoll.ts

Partly read, so not counted: apps/site/registry.ts (types, export block, the newest entries, and every id/path/package/load line), apps/site/icons.gen.ts (first ~120 lines), apps/site/icons/packages.mjs (first 40 lines), apps/site/icons/planet.mjs (first 40 lines).

<!-- done: 4 findings, files read: 40 -->