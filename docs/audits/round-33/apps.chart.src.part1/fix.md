The Sequence panel's Adds and Arrow pickers showed a value for a figure or arrow they don't name, so choosing it changed nothing (A+B): fixed cf1f0f4b95.

The Sequence pickers and the Activates/Deactivates selects showed only the first selected item's value, so a mixed selection couldn't be set to it (A): fixed 2530eec737.

File › Export turned a format off because of a page it would never write (A): fixed 90f0906ba0. I added a `page` option to `scenePageKinds`, so a one-page format like DOT now asks only about the page in view. That needed a `@weasel-js/diagram-formats` changeset (minor, `api`). I made the strict call for whole-document formats like Draw-style XML: they stay off while any page holds a kind they can't write, even though the writer would just leave that page out with a warning. The call is recorded in `docs/unruled.md` under "Audit round thirty-three".

The Data panel kept the last chart's error note and open rows when the selection moved to another chart (B): fixed b7816f203b.

The page tabs' "+" button added a blank page, not "a page of the chart's own type" as its doc says (B): fixed c93336bb6e. It now goes through `addChartPage` with the chart type's template, as Page › Add Page… does. This brings back that type's stencil groups even if the user had hidden them, matching Add Page.

Page Setup's target page was never cleared when the page went away, so a redo reopened the dialog (B): fixed 3bb18c91a1.

No extra defects found while fixing. App-only fixes carry no changeset because `apps/chart` isn't a published package.

Checks:
- `npx vitest run --maxWorkers=1 apps/chart/src/SequencePanel.test.tsx`: pass (14/14)
- `npx vitest run --maxWorkers=1 apps/chart/src/PlotDataSection.test.tsx`: pass (3/3)
- `npx vitest run --maxWorkers=1 apps/chart/src/App.test.tsx`: pass (27/27)
- `npx vitest run --maxWorkers=1 apps/chart/src/importExport.test.tsx`: pass (31/31)
- `npx vitest run --maxWorkers=1 packages/diagram-formats/src/sequencePage.test.ts`: pass (7/7)
- Unrun: `apps/chart/src/pages/pages.browser.test.tsx` (browser test; it clicks the "+" button that c93336bb6e changed)
- `npm run typecheck:packages -- diagram-formats`: pass ("1/1 diagram-formats ok")
- `apps/chart` isn't a package, so `typecheck:packages` doesn't cover it. I ran TypeScript 7 on `apps/chart/tsconfig.json`: no errors in changed files. Every error it printed comes from checking the app outside the root config (TS6059 rootDir, TS2882 CSS side-effect imports, `virtual:weasel-icons`, `ImportMeta.env` in `apps/shared`).
- eslint on every changed `.ts`/`.tsx` file: pass (exit 0)
- `npm run check:size`: pass ("no file or function grew past its cap")
- `npm run check:changesets`: pass ("OK — 1332 changeset(s)")
- Tree clean apart from `.skulk/`.