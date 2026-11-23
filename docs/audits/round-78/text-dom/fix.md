AltGr+letter not typed, styled instead (A): fixed 64ee361be2

Small caps re-split drops styling nested in a run span (A): fixed fb947bc229

Small caps re-split drops nested styling (B): duplicate of the small caps finding from A, fixed fb947bc229

Typing after the caret moves away and back joins the earlier undo step (A): fixed 10fef13745

`nodeStyle`/`effectiveStyle` show the node's own style while the edit waits with no container (A): fixed 9b259f5bf2

Ending and restarting an edit on the same node in one dispatch leaves an overlay with no draft, so later typing is lost (B): fixed 3de9f9664f

Extra: none. A property test in `overlayDraft.pbt.test.ts` said Alt does not affect styling shortcuts, which the AltGr fix contradicts. I updated it to match, in the same commit.

Checks:
- `npx vitest run --maxWorkers=1` on every test file touched, one at a time: pass. That covers `useTextEdit.shortcuts`, `domRuns.smcpBlock`, `useTextEdit.history`, `useTextEdit.container`, `useTextEdit.lifecycle`, `overlayTyping` and `overlayDraft.pbt`. All other `useTextEdit.*` and `domRuns.*` files also pass. No browser test files were touched.
- `npm run checks:gate`: pass, "checks:gate: all 33 passed". The first run failed on typecheck and `check:size`, both now fixed.
- `npm run lint -w @weasel-js/text-dom`: cannot run, because text-dom has no `lint` script. Instead, `npx eslint` on every changed `.ts`/`.tsx` file passed with exit 0.
- `npm run check:changesets`: pass, run as part of the gate.
- The tree is clean.

tally: 5 of 6 fixed, 0 extra fixed