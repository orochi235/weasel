The child step declared at only some selections replaces inherited tokens only there (A+B): fixed 2c9967343c
The single neutral anchor dropping `chroma.peak` and turning the ramp gray (A): fixed fa0bae99fb
The duplicate categorical anchor taking a later anchor's named step (A): fixed 5479e06571. It also adds an additive `Swatch.anchor` field, which has its own `minor` changeset because the field is new API.
The contrast rule on a one-step ramp failing on direction (A): fixed a961a2e422. Ends of equal lightness around a different middle are still reported, as the existing test requires.
`summarize` of an empty palette returning ±Infinity (A+B): fixed 41e5c2849b
`pinApplies` treating a pin with an unresolved seed inside its value list as applying (A): fixed a32fbaae13
An offset rule's `from` not accepting a ramp step or component, and a missing name not throwing (B): fixed 0d8c82b002
[r56-2] A child's by-axis pin bringing back the parent's pin on a step the child generates (carried): not a defect (no longer applies: `fillFromParent` skips shadowed names, and merge.test.ts covers it; the partial-selection case is handled by 2c9967343c)
[r56-5] `feasible` judged before equalization (carried): not a defect (no longer applies: `generate` checks `meetsGates` again on the equalized hexes)
[r56-6] `order: 'hue'` sorting raw anchor hues (carried): not a defect (no longer applies: anchors are put through `wrapDeg` before sorting)
[r56-7] A two-axis token declared only in blocks naming both axes (carried): not a defect (no longer applies: ruled 2026-11-21 in unruled.md, and `emitCss` declares it in every subset)
[r56-8] A token only a non-default theme declares never being reset (carried): not a defect (no longer applies: `emitCss` unsets it through `defaultLacks` and `lacks`)
[r56-11] `derive` reading a dotted reference whole (carried): not a defect (no longer applies: every reader goes through `refTarget`, which strips the group)

Checks:
- `npm run checks:gate`: pass ("checks:gate: all 33 passed"). The first run failed on a type error in semantics.ts and two changeset titles over 140 characters; I fixed both, squashed the fixes into their commits, and reran it.
- `npm run lint -w @weasel-js/theme`: not run, because `@weasel-js/theme` has no `lint` script. `npx eslint packages/theme/src/engine` instead: pass (exit 0).
- `npx vitest run --maxWorkers=1`, one file at a time: merge.test.ts pass (14), ramps.test.ts pass (17), color/generate.test.ts pass (23), semantics.test.ts pass (36), deps.test.ts pass (25).
- Each new test failed before its fix.
- I touched no browser test files. The tree is clean apart from `.skulkr/`.

tally: 7 of 13 fixed, 0 extra fixed