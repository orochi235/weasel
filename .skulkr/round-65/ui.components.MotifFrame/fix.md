Emphasized plaque/titlebar controls drawn in the wrong color (A): fixed 5f5fd19049

Empty-string title draws an empty heading and an unnamed group (A): fixed abd9bc5499

Tab squares the box corner while the tab sits a radius in from it (A): fixed 5e2a71533b

Sheet frame inside a PropertyPanel inherits the panel's blur and title inset (B): fixed b2f7357a07

`drawn('')` is true, so an empty title makes a named group with an empty heading (B): duplicate of the A empty-title finding (abd9bc5499)

DefaultMotif's doc says a `panel` kind reads `--wzl-panel-*` slots in any motif (B): fixed 31da574c22 (JSDoc corrected to say `PropertyPanel` reads them. Making `MotifFrame kind="panel"` read panel slots would mean moving the panel's stance rules into the frame, which is a design change, not a fix.)

Checks:
- `npx vitest run --maxWorkers=1 packages/ui/src/components/MotifFrame/MotifFrame.test.tsx`: pass (45 passed)
- `packages/ui/src/components/MotifFrame/motifs/edges.browser.test.tsx`: unrun (browser). It has one rewritten test (no blur behind a sheet inside a panel) and one new test (tab flush with the box edge).
- `npm run checks:gate`: pass ("checks:gate: all 32 passed")
- `npm run check:changesets`: pass ("OK — 3593 changeset(s)")
- `npm run lint -w @weasel-js/ui`: not available, because `@weasel-js/ui` has no `lint` script. I ran `npx eslint` on the changed .ts/.tsx files instead: pass (exit 0). The root `npm run lint` passed inside the gate.

tally: 5 of 6 fixed, 0 extra fixed