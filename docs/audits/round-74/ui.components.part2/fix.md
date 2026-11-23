ComboBox click repick: not a defect — `ComboBox.test.tsx` "commits the already-selected option again on a click" passes uncontrolled, and a throwaway test found that a click on the selected option commits once with only `selectedKey` controlled and with both `selectedKey` and `inputValue` controlled (B)

ComboBox `loadError` hidden under the default filter when no options are left (A): fixed dbe638eeba

ComboBox spinner adds a second grid row under `width="fit"` (A): fixed 6a62c2ead8 (its test is a browser test, unrun here)

Dialog overlay fade-in never runs, because the entering state is forced opaque (A): fixed 4402c569b9 (its test is a browser test, unrun here)

DataGrid non-sortable sorted column shows the arrow but has no `aria-sort` (A+B): fixed 8cc9c38425

ColorField pick on a mixed or unset field writes 100% opacity (B): fixed 01224e29a6. This was a behavior call, recorded in `docs/unruled.md`: such a pick now emits `#rrggbb` until the slider moves. `ColorControls`, which holds the alpha in its own channel, reports no alpha for it. Both halves were needed, and the changeset is tagged `behavior`.

DataGrid `aria-sort` (B's copy of the DataGrid finding): duplicate of the A+B DataGrid line above

Checks:
- `npx vitest run --maxWorkers=1` passed for `DataGrid/DataGrid.test.tsx` (28), `ComboBox/ComboBox.test.tsx` (28), `ColorField/ColorField.test.tsx` (20), `Properties/ColorControl.mixed.test.tsx` (2) and `Properties/ColorControl.cancel.test.tsx` (1).
- Unrun (browser): `ComboBox/ComboBox.browser.test.tsx` (new) and `Dialog/Dialog.browser.test.tsx`.
- `npm run checks:gate`: pass, "checks:gate: all 33 passed".
- `npm run lint -w @weasel-js/ui`: the package has no `lint` script (npm error: missing script). eslint on the changed directories: pass. The root `lint` inside the gate: pass.
- `npm run check:changesets`: pass, "OK — 738 changeset(s)".
- The tree is clean.

tally: 6 of 7 fixed, 0 extra fixed