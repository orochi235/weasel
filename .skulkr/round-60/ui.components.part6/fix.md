Fixed all ten distinct findings in 10 commits; three of the thirteen findings were the same defect reported by both reviewers. `checks:gate` passed.

- Alt+Left/Right in a tab's rename field moved the page instead of the caret (A+B): fixed 3a4b3ead9b
- A rename cut off by a hold reopened when the hold lifted (A): fixed 5fc812a6e5
- A PrefsBar cell's `ctx.source` read sibling and own leaves without their defaults (A): fixed 49381a4b9e
- An image read finishing after a hold still committed (A): fixed dd8dbd6155
- PatternPicker's upload committed through the hold and `onChange` of the render that started it (B): duplicate of A's image-read finding, fixed dd8dbd6155; this commit also sends a late read to the current `onChange`
- The size bar lit "M" for a texture paint and its presses did nothing (A): fixed 445073c9bf. The bar now lights no size and is disabled.
- The same texture size-bar finding (B): duplicate of A's, fixed 445073c9bf
- A Powerline segment kept a stale left cap from a replaced neighbor (A): fixed 47add390cc
- With `over` a `PrefSection`, aliases inside a bar's menu group vanished (A): fixed b24c00dbfc. This widens `over` in routing's `MenuSources` and ui's `BarMenuSources` to take a `PrefSection`, with an `api` changeset for both packages.
- An SVG with only a `viewBox` was stored square (A): fixed 7ab32d1487. It now takes its size from the viewBox when it decodes at 0×0. Whether real engines decode it at 0×0 was not checked, since that needs a browser.
- Plot2D mapped client points with separate x/y scales while the SVG draws with uniform `meet` scaling (B): fixed a51c2b6960. The point now maps through the same uniform scale and centering.
- A curved PageTabs drew a drop mark at the dragged tab's own slot (B): fixed f4a6aab46a. It now matches the straight strip, which also suppresses only the tab's own index and still marks the slot just after it.

No extra defects found. Nothing was recorded in `docs/unruled.md`.

Checks:
- Each touched test file, one at a time with `--maxWorkers=1`:
  - pass: PageTabs.test.tsx 16/16
  - pass: PageTabs.hold.test.tsx 6/6
  - pass: PageTabs.along.test.tsx 6/6
  - pass: PatternPicker.test.tsx 18/18
  - pass: PatternPicker.hold.test.tsx 5/5
  - pass: readImageFile.test.ts 2/2
  - pass: Powerline.test.tsx 13/13
  - pass: Bar.defaults.test.tsx 5/5
  - pass: Bar.over.test.tsx 8/8
  - pass: Bar.menu.test.tsx 6/6
  - pass: geometry.test.ts 6/6
  - pass: Plot2D.test.tsx 25/25
- Every other non-browser test file referencing PrefsBar or ToolbarDock: pass
- routing's `src/menus` tests: pass in the files that ran; I stopped that loop at its timeout before every file had run
- `npm run check:changesets`: pass ("OK — 3097 changeset(s)")
- `npm run checks:gate`: pass ("checks:gate: all 32 passed")
- `npm run lint -w @weasel-js/ui` and `npm run lint -w @weasel-js/routing`: not run, because neither package has a `lint` script. The root `npm run lint`, which covers `packages`, passed inside the gate.
- Browser tests: none touched.

The tree is clean.

tally: 13 of 13 fixed, 0 extra fixed