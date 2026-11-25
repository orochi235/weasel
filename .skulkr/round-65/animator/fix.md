- Color cycle keeps the frame loop running after the registry replaces or clears its override (A): fixed 35bacebf0f
- `direction: -1` plays the easing curve backward (B): fixed 777cfa95c3
- `setJointWeights` counts negative and NaN weights when it rescales (A+B): fixed 186c28fc55
- `refill` writes to the caller's options and throws when they are frozen (A+B): fixed dde839fbdc
- `createTargetTable` throws a bare RangeError for a fractional `capacity` (B): fixed 17fb1ec110. This was a behavior call nobody had made, so I made the strict one: a capacity that is not a whole number (including NaN and Infinity) now throws an error naming `capacity`. One below 1 still counts as 1. It is recorded in `docs/unruled.md` under a new "Audit round sixty-five" section.
- `readTarget` hands a custom `axes.add` a shared scratch that is too long and gets overwritten when the add reads another target (A): fixed ac7334c798. The `add` doc now says `delta` is `count` long and is reused once the call returns.
- Stagger handle reports its last time scale and pause after it ends (A): fixed 6ba76a692f
- `axisIndexes` checks the axis/path-prefix ambiguity only when `paths` is given (A): fixed fee604ea7a

No extra defects found.

Checks:
- Each touched test file, one at a time with `--maxWorkers=1`: pass. Files: colorCycle.cancelAll, colorCycle.direction, rig/weightEdits, targetTable.rows, target.add, stagger, and target.axisIndexes.
- The whole `packages/animator` suite (run with `--maxWorkers=4`): pass, 112 files and 990 tests.
- Every new test failed against the frozen source: verified for each fix.
- `npm run checks:gate`: pass ("checks:gate: all 32 passed"). The first run failed four checks: changeset titles over 140 characters, `check:size` on `target.ts` and `createTargetTable`, and a type error in a test. I folded the fixes into their own commits and reran it.
- `npm run lint -w packages/animator`: fail. The package has no `lint` script, so npm errors with "Did you mean…". In its place, eslint on every changed file passed.
- Tree clean; `.skulkr/` untouched.

tally: 8 of 8 fixed, 0 extra fixed