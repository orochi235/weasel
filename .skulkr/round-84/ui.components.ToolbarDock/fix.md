[A1] Drag measures the held layout, then drops it (A+B): fixed 14c780972a
[A2] Keyboard moves ignore RTL (A+B): fixed 4cc0fffd93
[A3] Pointer drops into a multi-column left or right dock fail under RTL (A+B): fixed 733fce6a6d
[A4] Empty-dock strips use physical insets under RTL (A+B): fixed 3730373cf8
[A5] Drop beside the only bar of an RTL row lands on the wrong side (A+B): fixed 13a6eed55d
[A6] Dock whose bars all draw nothing can't be dragged into (A+B): fixed 0b01e79fff
[A7] Reported least lengths are never cleared (A+B): fixed 655232cfb9
[A8] Layout passed again after a held move is replaced by it (A): not a defect (`resolveLayout` always returns a new object, and `useMemo` keeps only the latest value. Going A → B → A gives a fresh resolved object, never `held.over`.)
[A9] Dev nowhere-warning key leaves out the docks on offer (A): fixed 8a9e220fbf
[B1] Hidden-bar dock gets no strip and takes no drop (B): duplicate of A6
[B2] Single-bar RTL row takes the drop on the wrong side (B): duplicate of A5
[B3] Left and right docks under RTL: drops fail and strips sit on the wrong side (B): duplicate of A3 and A4
[B4] Alt+Left/Right reversed in an RTL top or bottom dock (B): duplicate of A2
[B5] Removing the dragged bar from `bars` mid-drag throws (B): fixed ac408d305c
[B6] Held move dropped by a pointer drag but kept by keyboard moves (B): duplicate of A1
[B7] Reported least length outlives its reporter (B): duplicate of A7
[B8] New-row zone of a dock the bar can't enter blocks one it can (B): fixed 9dfacc2569
[B9] Announced row number counts rows whose bars are all hidden (B): fixed cfd85813ac

Extra (sweep): the RTL columns fix added a `mirrored` field to `DockBox`, so a test fixture in `ToolbarDock.ends.test.tsx` needed it too. That went into 0b01e79fff. 9193ee52df shortens six changeset titles that `check:changesets` warned ran past 140 characters. Neither is a separate defect.

Checks:
- `npx vitest run --maxWorkers=1`, one file at a time: dockDrop.test.ts pass (7), useDockDrag.test.tsx pass (39), ToolbarDock.float.test.tsx pass (21), ToolbarDock.test.tsx pass (10), ToolbarDock.ends.test.tsx pass (13), ToolbarDock.along.test.tsx pass (1), layout.test.ts pass (31). Each new test failed with its fix reverted.
- ToolbarDock.browser.test.tsx (a new RTL empty-strip test): unrun, since browser tests can't run here.
- `npm run checks:gate`: pass ("checks:gate: all 33 passed").
- `npm run check:changesets`: pass ("OK — 1257 changeset(s), 102 with warnings", none of them from these changesets).
- `npm run lint -w @weasel-js/ui`: not run, because `@weasel-js/ui` has no `lint` script (npm error "Missing script"). The root `npm run lint` inside the gate passed.
- The tree is clean.

tally: 15 of 18 fixed, 0 extra fixed