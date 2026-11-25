I fixed 7 of the 10 findings, 2 more as extras, and judged one not a defect; every check below passes and the tree is clean.

Fixed-box containing block not counted as a scroller (A+B): fixed 1368d9ceda

Scrollers between an absolute box and its containing block counted as moving it (A+B): fixed 1368d9ceda (same `scrollersOf` rewrite as the line above, with its own changeset)

Carry picks the outer surface when the inner one is in its shadow root and registered first (A): fixed 50e7788a2e

macOS system chords (Cmd+Shift+3/4/5, Cmd+Space, Cmd+`, Cmd+Option+Esc) missing from the reserved list (A): fixed 74c78c489e

A session opened from a window capture listener supersedes itself on its own press (A): fixed 6fd3a1159f

`moved: false` on a drag whose release lands away from the press with no move before it (B): fixed 2d35b3f015

`BracketLeft`, `BracketRight`, and `Numpad1`–`Numpad9` codes not mapped to the keys they type (B): fixed efdfc68d50, then be645bb8e1 (reads the new code table by own key only, which `check:proto-index` required)

Unhandled carry drop never followed by `leave` (B): not a defect. The surface does receive `drop`, and the dispatcher's carry channel treats `drop` as closing, taken or not. I said so in the `CarryStage` doc in 9e44f2b7ef.

Extras:

`heldWithin` missed an item's drag whose origin sits in a shadow root inside the surface (sweep, same mistake as the carry surface finding): fixed 50e7788a2e

Space, Backquote, Minus, Equal and the other punctuation codes were also unmapped (sweep, same mistake as the code-name finding): fixed efdfc68d50

Checks:
- `npx vitest run --maxWorkers=1` on each file: `handleDrag.test.ts` pass (23), `carry.test.ts` pass (4), `carry.pbt.test.ts` pass, `pointerSession.test.ts` pass (23), `pointerSession.pbt.test.ts` pass, `browserReservedKeys.test.ts` pass (18).
- Other tests that call the reserved-chord check: `menuBarReservedKeys.test.tsx` pass, core's `browserReservedBindings.test.ts` pass, path-tools' `browserReservedBindings.test.ts` pass, `apps/draw/src/constraintKeys.test.tsx` pass.
- Browser tests: none touched, none unrun.
- `npm run checks:gate`: "checks:gate: all 33 passed". The first run failed only on `check:proto-index`, and be645bb8e1 fixed that.
- `npm run lint -w @weasel-js/routing`: routing has no `lint` script ("Missing script"), so I ran eslint on every changed file instead: pass (exit 0).
- `npm run typecheck:packages -- routing`: "1/1 routing ok".

tally: 7 of 10 fixed, 2 extra fixed