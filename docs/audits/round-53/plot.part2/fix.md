- xychart value axis flips when only one end is set past the data (A+B): fixed cf930efe33
- insertPacketField accepts a field that overlaps the one before it (A): fixed 853271ee25. I made the strict call (it throws, as `setPacketStart` does) and recorded it in `docs/unruled.md`.
- an xychart series object listed twice draws both copies in one bar slot (A): fixed 31a8592718
- sankey layout is quadratic in nodes × links (A): fixed e9a27799b3. There's no failing-first test, since a timing test would be flaky. The existing sankey tests pass, and a local benchmark (5,400 nodes, 10,400 links) produced identical output in 3.4–7.2 s before and 34–35 ms after. That figure is from this machine, not the fleet.
- sankey's typed flow accepts hex, binary, and octal; pie's rejects them (A+B): fixed 3dc22750eb. Both now read through one shared decimal reader, `typedAmountOf`.
- xychart row edits pad short series with zeros, so missing points get drawn (A): fixed be7fe1b0be. This was a behavior call, because the old test asserted the zero padding. A missing value now stays missing (written as `NaN`, drawn as no point), and an inserted row is a zero only in series that reach it. `setXyValue` had the same padding and is fixed in the same commit. Recorded in `docs/unruled.md`.
- an xychart drag runs a value past a set value-axis end (B): fixed 530773bc24. `xyValueAt` gains an optional third argument (the value axis), so it has two changesets: patch for the fix, minor for the API.

Extra:
- radar's rim flips when `max` is set at or below zero with no `min` (sweep, the same mistake as the xychart one): fixed 57cfed1def

Checks:
- `npx vitest run --maxWorkers=1` on `packages/plot/src/xychart/xychart.test.ts`, `xychart/structure.test.ts`, `radar/radar.test.ts`, `packet/structure.test.ts`, and `sankey/sankey.test.ts`: pass. Also pass: `xychart/structure.pbt.test.ts`, `packet/structure.pbt.test.ts`, `packet/packet.test.ts`, the pie tests, the other sankey tests, `diagram-formats/src/mermaid/plotAuthoring.test.ts`, and `diagram-formats/src/mermaid/xychart/xychart.test.ts`. No browser tests were touched.
- `npm run checks:gate`: first run failed (1 of 32: `check:changesets`, an api tag on a patch changeset and a title over 140 characters). After the fix it reads "checks:gate: all 32 passed".
- `npm run lint -w @weasel-js/plot`: fail, because the package has no `lint` script. `npx eslint` on every changed `.ts` file: pass. The root `npm run lint` in the gate: pass.
- Tree clean; `.skulk/` untouched.

tally: 9 of 9 fixed, 1 extra fixed