- `width='fit'` sizer measures labels without `--wzl-select-weight`, so a bold value is cut short (A): fixed 739d702fcf. The new test is `Select.fit.browser.test.tsx`, which can't run here, so it is unrun.
- `width='fit'` with no `placeholder` doesn't size for React Aria's "Select an item" (A): fixed 8d3ecd54b4. React Aria's string is read off the trigger, and the sizer keeps it after a value is picked. Two section tests now start with a value selected, since their placeholder is measured too.
- The re-measure cap never resets while the list is open (A+B): fixed 1aee7a69dd. The cap resets when `options`/`children` change. The fallback to `BELOW` and clearing `data-align` now happen before the cap is checked.
- Changing `gestures.dragPx`/`longPressMs` while the list is open re-arms the swallow of the next release (A): fixed 53c5bbf92e.
- A stale `pressRef` lets a keyboard-opened list swallow the first click on a row (B): fixed 4dbe53aaa6. The press is now forgotten once its pointer lifts. The list arms only against a press still held when it mounts.
- `--wzl-select-align: center` lined the list up on the left edge (A): fixed 1773d8285c. Centers are matched, and the list sets `data-align='center'` with its rows centered to match.
- With a description, the selected row's label is measured together with its note (B): fixed 12352269ae. The label now sits in its own box, and the note is a sibling inside `.optionBody`. `.optionBody` is `display: contents` in the trigger.

Extra:
- `check:size` failed on `Select.tsx` (429 lines, `Select` at 132 lines) and on `AlignOverTrigger` (123 lines) after these fixes: fixed 6ab8e187af. The rows moved to `selectItem.tsx`, and the trigger press and the release handling moved into hooks (`useTriggerPress`, `useKeepOpeningRelease`). This is internal only, with no changeset. It cleans up after my own fixes, so it isn't counted in X.

Checks:
- `npx vitest run --maxWorkers=1` on `Select.test.tsx`: pass (54). `alignOverTrigger.test.tsx`: pass (7). `Select.popup.test.tsx`: pass (2). `Select.held.test.tsx`: pass (5).
- `Select.fit.browser.test.tsx`: unrun (browser).
- Each new test was confirmed failing against the pre-fix source.
- `npm run checks:gate`: the first run failed (`check:size`); after 6ab8e187af, "checks:gate: all 33 passed".
- `npm run typecheck:packages -- ui`: pass.
- `npm run lint -w @weasel-js/ui`: not applicable, because the package has no `lint` script. Root `npm run lint` passed inside the gate.
- The tree is clean.

tally: 7 of 8 fixed, 0 extra fixed