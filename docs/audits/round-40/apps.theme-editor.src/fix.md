fixed 272f08a999 | editing a by-axis seed stores its JSON text as a string seed (A+B): the Seeds layer now shows the seed's value at the current selection and writes only that branch.

fixed 272f08a999 | editing a by-axis pin in Pins or Components overwrites every branch with one flat value (A+B): this is the same mistake as the seed finding, fixed by the same new `writeAt`/`leafAt` helpers in `theme/model.ts`.

fixed bf13dd58e5 | Inspect misses tokens a component reads through its own private custom properties (A): it now follows each custom property that a real declaration reads (`--btn-radius` → `--wzl-button-radius`, and accent remaps), and one that nothing reads still adds nothing.

fixed c00042c6af | "Compare in preview" shows two identical previews when a ramp's pins are all inherited (A): the button now uses the same own-pins test as "Adopt generated".

fixed 01ef3a0deb | PinRepair labels a bezier or other array pin "varies by axis" and offers no field (A): array pins now edit as text through `serializeTokenValue`/`parseTokenValue`. "varies by axis" is shown only for a pin that does, and any other uneditable pin reads "not editable here".

fixed 3bd947e0ab | changing the Ramp of a rule whose step varies by axis drops the variation (B): every branch's step is kept when the new ramp has it, and only a step the new ramp lacks moves to its first step. The same now holds for a plain step, which used to reset even when the new ramp had the same step.

fixed 5a44d8a8fa | the palette lab's stat verdicts use fixed thresholds, not the gates set (B): a new `gateVerdict` in `palette/unmetGates.ts` decides both the stat colors and the infeasible line, and a gate set to 0 shows no verdict.

fixed 6e6fce6d75 | "Copy as tokens" writes duplicate keys when an anchor shares a name with a generated swatch (B): the cause was in `@weasel-js/theme`'s `generate`, outside this area. It named generated swatches by hue without regard to the anchors' names, so I fixed it there. Anchor names are claimed first, and any repeat becomes `name-2`, including two anchors that share a name. That case is my own call, not one anyone has ruled on. It comes with a changeset (`palette-swatch-names-distinct.md`, patch, fix) and an updated property test in `generate.pbt.test.ts`.

fixed fee4ba3abd | the New theme dialog reopens with the last name and its error (B): opening it now clears both.

No extra defects turned up beyond these. Only the swatch-name fix got a changeset: the theme editor is an unpublished app, and earlier fixes in this area shipped without one.

Checks:
- Test files, one at a time with `--maxWorkers=1`, all pass: TokenLayer.test.tsx 12/12, theme/entries.test.ts 9/9, theme/inspect.test.ts 3/3, layers/RampsLayer.test.tsx 10/10, ThemeWorkbench.test.tsx 16/16, ThemeEditor.test.tsx 8/8, PinRepair.test.tsx 4/4, layers/SemanticDrawer.test.tsx 5/5, layers/SemanticsLayer.test.tsx 12/12, PalettePreview.test.tsx (new) 2/2, PaletteLab.test.tsx 5/5, PaletteLab.copy.test.tsx 4/4, packages/theme engine/color generate.test.ts 19/19, generate.pbt.test.ts 2/2, generate.shrunk.test.ts 2/2, cost.test.ts 2/2, engine/ramps.test.ts 12/12, engine/ramps.pbt.test.ts 4/4, colorList.test.ts 14/14. No browser tests were touched.
- `npm run check:changesets`: pass, "OK — 1893 changeset(s)."
- `npm run checks:gate`: pass, "checks:gate: all 32 passed". That includes the root `npm run typecheck`, the root `npm run lint` (eslint over packages, apps, and tests, 57.7 s), and `typecheck:packages`.
- `npm run lint -w @weasel-js/theme`: unrun. A hook here refused it as suite-sized on the controller machine. Neither `@weasel-js/theme` nor the theme editor has a lint script of its own; their lint is the root `npm run lint`, which passed inside the gate.
- The tree is clean, apart from `.skulk/`, which I left alone.