Pressed confirm button never dimmed, its selector matched nothing (A+B): fixed 40bfcbdd1f

Pressing a soft-disabled solid or confirm button still dimmed its gloss (A+B): fixed 9e5c3c9900, with a type fix to its test in 8e1e1ae9a2

Exported shape deltas pasted into `.button` gave every size the md metrics and overrode the theme's hooks (A+B): fixed 8c919b34e5. Shape values now export as `.size_md` / `.button` `--btn-*` values, with the theme hook still read first.

Lab's Radius, Pad x, and Weight knobs did nothing on the segmented target but still exported (A): fixed bc8836c0cf. A segmented export leaves them out, and the lab says they tune a button only.

Checks:
- `npx vitest run --maxWorkers=1 packages/ui/src/components/Button/Button.test.tsx`: pass (34 passed)
- `npx vitest run --maxWorkers=1 packages/ui/src/components/Button/lab/buttonLabConfig.test.ts`: pass (6 passed)
- `npm run checks:gate`: the first run failed (typecheck and typecheck:packages, TS2345 in my new test). After 8e1e1ae9a2 it passed: "checks:gate: all 32 passed"
- `npm run lint -w @weasel-js/ui`: not run, because `@weasel-js/ui` has no `lint` script. The gate's eslint and checks passed.
- Unrun: `ButtonLabView.browser.test.tsx` is a browser test and cannot run here.
- Changesets: two, for the two CSS fixes. The lab fixes change only a story, so they have none. `check:changesets` passed inside the gate.

tally: 4 of 4 fixed, 0 extra fixed