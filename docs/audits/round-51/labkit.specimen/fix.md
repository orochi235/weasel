- Rings slider stuck at 32 with a no-op onChange (A+B): fixed 2022d0627a
- SidebarPanel hide button does nothing (A+B): fixed c87265dcd1
- Momentary SegmentedBar (Undo/Redo) toolbar has no accessible name (A): fixed a56d0572a3
- Demo ToastRegion takes the app-wide refusal toasts while mounted (B): fixed f67aef84f7
- InlineRange cell bypasses the edit protocol, so Escape doesn't cancel a drag (B): fixed 8de54bc905
- Right-docked Sidebar draws at the left edge of its box (B): fixed eb32f1bcbd
- Rings slider (B's copy): duplicate of the A+B line above
- SidebarPanel hide button (B's copy): duplicate of the A+B line above

Extra defects: none. A sweep of the whole specimen finds every toolbar named now. The only unnamed `group` roles left are inside kit components (NumberField frames, plot SVGs, `Bar` action groups). ARIA doesn't require a group to have a name, so I left them alone. Two follow-up commits only satisfy checks, they aren't defects: fa0e0b7fa3 applies biome formatting, and 01dec576b6 gives the test's class the `lk-` prefix. All six tests are in the new `packages/labkit/src/specimen/cells.test.tsx`, each failing before its fix. Each fix has its own changeset. Nothing went into `docs/unruled.md`.

Checks:
- `npx vitest run --maxWorkers=1 packages/labkit/src/specimen/cells.test.tsx`: pass (6/6)
- `npx vitest run --maxWorkers=1 packages/labkit/src/specimen/Specimen.test.tsx`: pass (1/1)
- `npm run check:changesets`: pass ("OK — 2543 changeset(s).")
- `npm run lint -w @weasel-js/labkit`: pass. It first failed on biome formatting and on the `lk-` class prefix in the new test; both are fixed and it was rerun.
- `npm run checks:gate`: pass ("checks:gate: all 32 passed")
- Unrun browser tests: none.

The tree is clean.

tally: 6 of 8 fixed, 0 extra fixed