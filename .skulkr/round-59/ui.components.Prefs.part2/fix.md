Nested bar section run keyed by `<object>.<key>` instead of its section path, so two runs collide (A+B): fixed 0323f18836. The B copy is a duplicate of A's.

`warnUnmatchedRenderers` treats a section's key as a path segment (A+B): fixed 3dbd7f4acb. The B copy is a duplicate of A's.

Union variant select offers an "Unset" entry that does nothing (A+B): fixed cb89b8fe1e. The B copy is a duplicate of A's.

Union fields wrap `update` with the tag but not `drafts` (A): fixed 80ecb2d9c2.

`MARKED` disagrees with `selection.css` on fragments (A+B): fixed 4c039f8899. The B copy is a duplicate of A's.

Cmd-toggling the last selected row off scrolls the form mid-click (A): fixed db48e19732.

Object-leaf fields ignore the leaf's `disabled` whenever `disabledAt` is given (B): fixed 5b45feafa0. The alias and list-entry cases B described did not reproduce. I tested them in `PrefsForm` and their fields came out disabled: the form's condition walk already lists every field under a disabled leaf. The case that does break is a `PrefControl` given both `disabled` and a `disabledAt`. Its fields stayed editable, and it now answers every path disabled. I left `objectFieldContext` alone, because adding `ctx.disabled` there would also disable the switch field that a leaf's own `enableIf` reads, which is designed to stay live.

Extra (sweep), filed rather than fixed, in dbf06dfeef: in `PrefsForm`, an object leaf's own `enableIf` disables its switch field anyway. `applyPrefConditions` spares the field and `objectFieldContext` passes it `disabled: false`, but the leaf's disabled `PropertyRow` disables every control inside it, so the leaf can never be turned back on. Measured in jsdom. Fixing it needs a new `PropertyRow` mode that dims the label without disabling the controls, checked in both `PrefsForm` and `SelectionPanel`. That is an API design change too big for this pass, so it is a P3 entry in `docs/TODO.md` under "Selection, actions & UI panels".

Checks:
- `npx vitest run --maxWorkers=1`, one file at a time:
  - `objectRows.test.tsx`: pass (1)
  - `unmatchedRenderers.test.ts`: pass (2)
  - `PrefsForm.selection.test.tsx`: pass (14)
  - `PrefsForm.kinds.test.tsx`: pass (20)
  - `renderLeaf.test.tsx`: pass (1)
  - `PrefsForm.itemConditions.test.tsx`: pass (5)
  - Neighbors also passed: `PrefsForm.objectSection`, `.as`, `.split`, `.renderers`, `.fragment`, `.mixedCompound`, `.conditions`, `.splitKinds`, `.entryConditions`, `.aliasConditions`, `.absent`, `params.kitSettings`, `renderBarLeaf`, and ui-canvas `SelectionPanel.selection`, `.flagBarMark`, `.compound`.
- `npm run check:changesets`: pass (`OK — 3038 changeset(s).`)
- `npm run checks:gate`: pass (`checks:gate: all 32 passed`)
- `npm run lint -w @weasel-js/ui`: unrun, because the package has no `lint` script (only `build` and `test`). I ran eslint on every changed file instead: pass, no output. The gate's root `npm run lint` passed.
- No `*.browser.test.*` file was touched.

The tree is clean, with eight commits on top of 504fd0de82.

tally: 11 of 11 fixed, 0 extra fixed