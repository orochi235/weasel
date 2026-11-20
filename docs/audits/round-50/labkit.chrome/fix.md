- A's status-bar finding: a status readout without `end` lands at the far end, after the FPS meter (A, overlaps B) — fixed 333b16ed91. The status bar now groups its readouts and puts only `end` groups past the spacer. The FPS meter no longer shares the `view` group, so the scale bar stays at the near end.
- `group`/`end` are ignored or mean different things in the title bar, viewport, sidebar, and palette (A) — fixed dadfa40790. These regions now use the toolbar's grouping, with `end` groups last.
- A group takes its `end` from its first member only (A) — fixed 507ba5d6d5
- A header item with `keys` loses its declared `shortcut` when no command is registered (A) — fixed 2efded7473
- An ungrouped toolbar entry is announced by its contribution id (A) — fixed 1ba1b0871c. Named groups are still announced by their group name; recorded in `docs/unruled.md`.
- An unbound tool still shows its declared key on the rail (A) — not a defect. `useSceneToolSlot` reports every tool in the registry, a keyless one as `[]`. `shownKey` treats `[]` as reported and shows no key. The `setToolShortcuts` contract asks a reporter to name every tool, so it only falls back to the declared key for a tool the report leaves out.
- "Copy settings as JSON" ignores the instrument's auto reports (B) — fixed c52ad2d7a8. It now applies `withAutoReports`, as the Settings panel does.
- A toolbar contribution without `end`, declared after a built-in `end` group, lands at the far end (B) — fixed 8ddd9c9733. `groupsOf` now moves `end` runs after the rest. The status-bar half of this finding is the same bug as A's status-bar finding, fixed in 333b16ed91.
- `end` on a later member of a group is dropped (B) — duplicate of A's first-member finding, fixed 507ba5d6d5
- The palette and viewport drop `end`, and the viewport drops `group` (B) — duplicate of A's region finding, fixed dadfa40790

Calls recorded in `docs/unruled.md`: cabeaf1660 covers the layout rules for every region (in the viewport, sidebar, and palette, which draw no spacer, the far end means last) and the group-naming rule.

Extra defects:
- `check:numeric` failed on `apps/draw/src/dev/audits/Treemap.module.css`, a raw `font-variant-numeric`; already in the frozen tree, outside this area — fixed b33a8e0361
- labkit's design-token check, part of `lint -w @weasel-js/labkit`, failed on a raw px `font-size` in ui's `SpanStrip.module.css`; already in the frozen tree, outside this area — fixed 1f10a29e20

Checks:
- `npx vitest run --maxWorkers=1`, one file at a time, all pass:
  - `regions/groupsOf.test.ts` 2/2
  - `regions/ToolbarRegion.test.tsx` 11/11
  - `regions/regions.test.tsx` 15/15
  - `regions/regionOrder.test.tsx` 5/5
  - `regions/TitleBarRegion.test.tsx` 7/7
  - `regions/PaletteRegion.test.tsx` 10/10
  - `regions/SidebarPanes.test.tsx` 5/5
  - `regions/SidebarRegion.test.tsx` 5/5
  - `boundShortcuts.test.ts` 1/1
  - `trialActions.test.ts` 1/1
  - `builtins.test.ts` 26/26
  - `labRegions.test.tsx` 15/15
- Each new test was confirmed to fail before its fix.
- Unrun: `regions/SidebarPanes.browser.test.tsx` and `regions/ViewportRegion.browser.test.tsx`. They are browser tests, and their regions changed.
- `npm run checks:gate`: pass, "checks:gate: all 32 passed". That includes `typecheck`, `typecheck:packages`, every `check:*`, and `npm run lint -w @weasel-js/labkit`.
- A standalone `npm run lint -w @weasel-js/labkit` was refused by this machine's hook as a suite-sized script. Its gate step passed, and ui has no lint script.
- `npm run check:changesets`: pass.
- Tree clean; `.skulk/` untouched.

tally: 9 of 10 fixed, 2 extra fixed