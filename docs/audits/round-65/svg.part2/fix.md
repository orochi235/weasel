[A] Unresolved `url()` paint imports as solid black: fixed a01b75b0bf
[A] Markers dropped when stroke is `none` or unset: fixed 9957be0011 (the SvgNode level now keeps them; filed a P3 TODO because the kit renderer's `drawPath` still draws no heads for a stroke with no paint, and `svgNodesToKitDrafts` drops that stroke, which is a renderer change outside this area)
[A] A tspan's `baseline-shift` length was divided by its own font size: fixed 9975c0310b (round 63's test had asserted the own-size reading, which contradicts `StyledRun.baselineShift`'s documented unit, so I corrected it; `em` is now taken of the tspan's own size)
[A] An invalid stroke-width, font-size, dash, letter-spacing, marker or clip-path declaration overrode a valid one: fixed f01072ff83
[A] Keyword `refX`/`refY` on a marker with no viewBox resolved to 0: fixed ff5e08d37d
[A] Marker children that are `display="none"` or hidden were drawn: fixed e54244aea1 (moved `isHiddenElement` into `hiddenElement.ts` so parse and markers share one definition)
[A] Mesh patch point `x,` read as `(x, 0)`: fixed 62d504dba2
[B] Missing or dropped paint server paints black: duplicate of the unresolved `url()` paint finding from A, fixed a01b75b0bf
[B] A zero-width run stroke writes nothing, so the tspan takes the text's stroke: fixed a1f4b356ad
[B] A meta child in another namespace was written back in its parent's namespace: fixed f570bd50a0
[B] Imported markers registered globally and never released: not a defect (entries are keyed by what they draw, so the registry grows only with distinct markers; a node can come back through undo or paste and name its key again, so the registry cannot know when an entry is unused)
[B] Golden round-trip `round` produced -0: fixed 87dd71499c (test-only helper, not exported, so no changeset)
[r63-1] Negative stroke-width or font-size kept: carried, not a defect (no longer applies, 2c93ce3db5)
[r63-2] tspan `font-style="normal"` did not undo italic: carried, not a defect (no longer applies, a82e65b485)
[r63-3] viewBox parser rejected abutting numbers: carried, not a defect (no longer applies, 7dd6c75405)
[r63-4] An unclosed style block lost its last character: carried, not a defect (no longer applies, e6c3bdd382)
[r63-5] font-weight `lighter` not read: carried, not a defect (no longer applies, c201aebf23)
[r63-6] `dominant-baseline="text-top"` read as a baseline anchor: carried, not a defect (no longer applies, 482acd3fc6)
[r63-7] Pattern export ignored `units`: carried, not a defect (no longer applies, cb268d7d52 and the round-63 unruled entry)
[r63-8] A document's own `<marker>` was ignored when its id matched a kit key: carried, not a defect (no longer applies, fc3aeaf97a)
[r63-9] Image pattern `patternTransform` warnings dropped: carried, not a defect (no longer applies, 62ce053e60)
[r63-10] Conic center ignored userSpaceOnUse length semantics: carried, not a defect (no longer applies, 0dbf7f0000)
[r63-11] tspan user-space stroke gradient not carried through the text transform: carried, not a defect (no longer applies, 66824dca9f)
[r63-12] Run fill and stroke took the node's opacity: carried, not a defect (no longer applies, b4e4fa4436)
[r63-13] A nested tspan lost its styling silently: carried, not a defect (no longer applies, 0080be902b)
[r63-14] Same-local-name namespaced attributes overwrote each other: carried, not a defect (no longer applies, 265137cdd1)

Extra:
[sweep] `<tspan stroke="none">` inside stroked text imported with the text's stroke: fixed 16393f5920

Checks:
- `npx vitest run --maxWorkers=1` on each touched test file, one at a time: pass (cascade 64, gradients 25, markers 23, mesh 10, readRuns.stroke 8, roundtrip.metadata 7, roundtrip.textScript 14, testing/roundTrip 3)
- Every test file under `packages/svg/src`: pass (98 files, 1232 tests)
- `npm run checks:gate`: pass, "checks:gate: all 32 passed"
- `npm run lint -w @weasel-js/svg`: not run, because the package has no `lint` script (only `test` and `build`). In its place, `npx eslint packages/svg/src`: pass, no output.
- `npm run typecheck:packages -- svg`: pass, "1/1 svg ok"
- No browser test files touched. Tree clean.

tally: 11 of 26 fixed, 1 extra fixed