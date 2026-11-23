PinRepair numeric pin turns into a string per keystroke (A, joined with B's list-pin finding): fixed 17b3c27a0e (field holds typed text, converts against the value the edit began from), with 1eb6607c75 (cleared field keeps the number)
SemanticDrawer literal loses its number once the field is cleared (A): fixed 1eb6607c75
Reload clears the draft without waiting, so the remount can reopen it (A): fixed 8f4403c153
Save stays enabled while the draft does not derive (A): fixed 6b2a5e2261
Stored preset named like a built-in loads beside it (A): fixed d82f6f1f9b
List-valued pin in PinRepair cannot be typed (B): duplicate of A's PinRepair numeric-pin finding, fixed 17b3c27a0e
Step lists read without the theme's scope (B): fixed 4cd89efe2c (rampView, ownTokenNames/countTokens/layerEntries, and GatesEditor now take the merged definition; with no scope, a seed-named step dropped the ramp's whole step list, not just that one step)
Theme prefs undo history has no limit (B): fixed a169347120 (shares the lab pages' `HISTORY_LIMIT`)
PinRepair "named in the error" matches substrings (B): fixed 0805fc2725
Stored preset list can hold duplicate or built-in names (B): duplicate of A's preset finding, fixed d82f6f1f9b (also keeps only the last entry of a repeated name)
"Varies by" off does nothing on a branch the rule lacks (B): fixed 319ab39e88
Light and dark surfaces defined twice in PaletteLab and PalettePreview (B): fixed dcf9ce6ca1 (`SURFACES` now in presets.ts beside `SurfaceKey`; the new test passes before and after, since the duplication was latent)
pickRule and leafAt are two implementations (B): fixed 91162d4ed0 (with a mode value named `by`, `pickRule` returned the axis name, and `semanticRows` threw `TypeError: Cannot use 'in' operator`)

No changesets: apps/theme-editor is not a published package.

Checks:
- `npx vitest run --maxWorkers=1`, run one at a time on each touched file: ThemeEditor.reload.test.tsx pass, ThemeEditor.test.tsx pass, PinRepair.test.tsx pass, layers/SemanticDrawer.test.tsx pass, ThemeWorkbench.test.tsx pass, presets.test.ts pass, PresetBar.test.tsx pass, usePrefsHistory.test.ts pass, useLabHistory.test.ts pass, PalettePreview.test.tsx pass, PaletteLab.test.tsx pass, PaletteLab.copy.test.tsx pass, theme/semantics.test.ts pass, layers/SemanticsLayer.test.tsx pass, theme/ramps.test.ts pass, theme/model.test.ts pass, theme/entries.test.ts pass, theme/starter.test.ts pass, TokenLayer.test.tsx pass, layers/RampsLayer.test.tsx pass, autoReset.surfaces.test.tsx pass
- `npm run typecheck`: pass
- `npm run checks:gate`: "checks:gate: all 33 passed"
- `npm run lint -w <pkg>`: not applicable, since theme-editor is not a workspace package. Root `npm run lint` passed inside the gate.

tally: 13 of 13 fixed, 0 extra fixed