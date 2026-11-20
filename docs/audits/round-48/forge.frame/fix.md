Shadow-DOM targets can't be highlighted because they get joined into one selector (A+B, `a11y.ts:60`): fixed 6d8d435f6e
Index page ignores `a11y.highlight` (A+B, `startIndex.tsx:86`): fixed ddf023bc3f
Index page never reports or applies document scroll (A+B, `startIndex.tsx:46`): fixed 2e4304eb7e
Index page ignores `vars.set` (B, part of its combined index finding): fixed e3674044c5
Overriding a token leaves vars defined through it stale (A+B, `cssVarsWatch.ts:53`): fixed a6136e3dba
A throw from `applyGlobals` on an index page escapes, so the trial never hears back (B, `startIndex.tsx:91`): fixed 2f111c472d
Index page's fault drops the stack (B, `startIndex.tsx:68`): fixed 7c598e9e32
Highlight box misplaced for a target inside an iframe, and doesn't follow its scroll (A+B, `a11yHighlight.ts:42`): fixed 3eccbc3aeb

Extra (sweep):
Index page answered `a11y.run` with its own copy of `auditElement`'s ok/error wrapping (same behavior, a second path): folded into `auditElement`, ade3500219 (internal, no changeset)
Index page's render fault carried no `seq`, so the shell could not drop a stale one: fixed in 7c598e9e32 and 2f111c472d. The index frame now counts `init`/`config`/`state`/`globals` the way the shell does.

Notes:
- The story frame's highlight, scroll and vars handling now lives in one shared helper, `packages/forge/src/frame/frameServices.ts`. `startFrame` and `startIndex` both call it, so the two frame kinds answer these messages through the same code.
- Each fix's new test failed with the fix reverted and passes with it.
- No call was needed in `docs/unruled.md`.

Checks:
- `npx vitest run --maxWorkers=1 packages/forge/src/frame/cssVarsWatch.test.ts`: pass (1/1)
- `npx vitest run --maxWorkers=1 packages/forge/src/frame/a11y.test.tsx`: pass (7/7)
- `npx vitest run --maxWorkers=1 packages/forge/src/frame/index/startIndex.test.tsx`: pass (13/13)
- `npx vitest run --maxWorkers=1 packages/forge/src/frame/a11yHighlight.test.ts`: pass (4/4)
- `npx vitest run --maxWorkers=1 packages/forge/src/frame/FrameController.test.tsx`: pass (22/22)
- `npx vitest run --maxWorkers=1 packages/forge/src/frame/mountFrame.test.ts`: pass (16/16)
- `npm run checks:gate`: pass ("checks:gate: all 32 passed")
- `npm run check:changesets`: pass ("OK — 2238 changeset(s).")
- `npm run typecheck:packages -- forge`: pass ("1/1 forge ok")
- `npm run lint -w @weasel-js/forge`: not run, because forge has no `lint` script (npm: missing script). The gate's root `npm run lint` passed.
- Unrun: none. No `*.browser.test.*` file was touched.

The tree is clean and every change is committed.

tally: 11 of 11 fixed, 2 extra fixed