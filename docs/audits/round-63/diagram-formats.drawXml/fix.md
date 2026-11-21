- `bar` marker written as the draw app's slanted `dash` (A): fixed 8522c1a762
- `absoluteArcSize=1` ignored when reading a rounded box (A+B): fixed 46e5186819
- unknown shape with `rounded=1` read with no warning (A): fixed 03c66f704b
- container holding one tall container reads back as a pool (A): fixed 08b76e0351
- cluster whose members sit in an earlier cluster is nested inside it (A): fixed 39db3a88ae
- `avoid` router written as orthogonal with no warning (A): fixed c5c3ba32bc
- HTML label keeps literal newlines and runs of spaces (A+B): fixed aaf9c8894c
- dragged label on a self-loop with no bends loses its offset (A+B): fixed 797651e4bc
- draw-style XML claims only `.xml`, so `.drawio` files can't be picked (B): fixed 6393e84d18
- writer's font ignores `weight`, header rows, and rows after the first (B): fixed be55d75499
- `UserObject` `placeholders="1"` labels read unsubstituted (B): fixed 16e4835ba0
- empty pool reads back as a plain container (B): duplicate of "container holding one tall container" (08b76e0351; the new `weaselRole` style key covers both)
- `absoluteArcSize` ignored (B): duplicate of the A finding (46e5186819)
- HTML newlines and spaces kept (B): duplicate of the A finding (aaf9c8894c)
- self-loop label offset lost (B): duplicate of the A finding (797651e4bc)

Extra: none. a32122e503 only fixes the type errors the gate found in my new test file (it passed `theme` to `write`, which `WriteOptions` doesn't accept). That means the intermediate commits from 8522c1a762 to 16e4835ba0 fail typecheck on their own; HEAD passes.

Checks:
- `npx vitest run --maxWorkers=1 packages/diagram-formats/src/drawXml/fidelity.test.ts`: pass (15 passed)
- `npx vitest run --maxWorkers=1 packages/diagram-formats/src/drawXml/cellText.test.ts`: pass (7 passed)
- `npx vitest run --maxWorkers=1 packages/diagram-formats/src/`: pass (839 passed, before the test-typing commit)
- `npm run checks:gate`: pass ("checks:gate: all 32 passed")
- `npm run check:changesets`: pass ("OK — 3220 changeset(s).")
- `npm run lint -w @weasel-js/diagram-formats`: not run, because the package has no `lint` script ("Missing script: lint"). Instead, `eslint packages/diagram-formats/src/drawXml`: pass (exit 0)

tally: 11 of 15 fixed, 0 extra fixed