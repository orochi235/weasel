Fixed all 15 distinct findings in 15 commits. The slot finding is only partly fixed (see below). Every check passes.

- **Header row dropped by `rowLines`, with a misleading warning** (A+B): fixed 309306371b
- **`hexColor` passes `hsl()`/`oklch()`/`color()` through unconverted** (A): fixed 00399fe2d5
- **DOT reads and writes color names as CSS, but Graphviz uses X11** (B): fixed 559a0131ff. Bare names and `/x11/` names now read as X11 colors, including `grayN`/`greyN`. `/svg/` names still read as CSS, and DOT writes every color name except `transparent` as hex.
- **DOT drops a cluster's dash in both directions** (A): fixed d99252f0fe
- **The DOT `node`/`edge` defaults leave out the theme's `penwidth` (and default dash)** (A+B): fixed a65aa01fc6
- **DOT drops a node's size on an unplaced page** (B): fixed 2b6840d151
- **DOT `detect` refuses an HTML graph id** (A): fixed 9c7b0b4991
- **DOT `detect` refuses an indented `#` line** (B): fixed 9c7b0b4991 (same commit as the line above; both live in the header check)
- **HTML DOT labels read with blank lines from the source's own line breaks, and table cells run together** (A): fixed 063641980d
- **Diagram JSON accepts a page with no `data`/`width`/`height`** (A+B): fixed bf58445a1e. This was a strict call, recorded in `docs/unruled.md`: the reader now refuses a page with no string id, no finite size, or no `data` object, and a graph page without `nodes`/`edges` lists.
- **`WriteOptions.page` naming a missing page silently writes the first** (B): fixed c375bf37fe. Also a strict call, recorded in `docs/unruled.md`: `writtenPage` and `scenePageKinds` now throw a `RangeError` for an unknown page id, and an unset page still means the first. This changes behavior on purpose: an existing test that expected the first-page fallback for `'nowhere'` now expects the throw.
- **`addTemplatePage` draws in the night theme whatever theme the scene names** (A+B): fixed b45398bb08. It now defaults to the scene's own theme, and the README says so.
- **`scenePageKinds` and `documentFromScene` disagree on a plot or sequence page** (A+B): fixed 466a509977. Both now use a new `pageRootsOf`: only outermost roots count, and a plot beats a sequence on the same page.
- **`readShape` drops slot rows, image slots included** (A): fixed 98bf3e280a, partly. Slots with an image or an id now read back in place with their height, width, id and image. A slot with neither can't be recovered here: it creates no scene node, and `@weasel-js/diagram`'s `bodyLayoutOf` records no row heights for any body with a slot row. Fixing that means recording slot bodies in the diagram package's relayout, which is another area, so I didn't file or change it. The changeset says this.
- **A shape in both a container and a cluster loses its cluster membership with no warning** (A): fixed 98171a1f04
- **`sortedPage` sorts lanes, whose order matters, and never sorts clusters** (B): fixed b9dbad7e47 (test-only helper; it isn't exported, so no changeset)

No extra defects beyond the partial slot case above.

Checks:
- `npm run checks:gate`: **pass** ("checks:gate: all 32 passed"). The first run failed on one TS2345 in `fromScene.ts` and 10 changeset titles over 140 characters. I fixed both and folded the fixes into their own commits before the rerun.
- `npm run check:changesets`: **pass** ("OK — 2040 changeset(s)")
- `npm run lint -w @weasel-js/diagram-formats`: **can't run**, because the package has no `lint` script ("Missing script: lint"). Instead, eslint on every changed `.ts` file: **pass**.
- Each touched test file, alone with `--maxWorkers=1`: all **pass**: `colorCheck` 6, `dot/format` 3, `dot/values` 5, `dot/write` 24, `jsonFormat` 6, `pageRoots` 1, `rowLines` 6, `sceneReaders.slots` 1, `sequencePage` 7, `templates/templates` 39, `testing/samePage` 2.
- The whole `diagram-formats` package under `weasel-ui`, before the last two commits: **pass** (83 files, 745 tests). After the last commits, only the changed test files above were rerun.
- No browser tests were touched. The tree is clean, and `.skulk/` is untouched.