# Task 6 report: forge's globals on the menu bar

Implemented per brief. `globalsMenu(declarations)` returns a bar with one `globals` group (`as: 'menu'`), a submenu per declaration keyed `d<n>`, rows keyed `o<i>` (`App` first when `follows`), each `pref.action('fg.global.<key>.<value>')`. All options are listed (including ones `shows` hides) so the menu structure is stable; hidden ones are disabled via `GlobalsCommands`. `GlobalsCommands` registers `useCommand` per option with `active` and `enabled` (NotApplicable when not in `labOptions`). Workshop passes `menus` via new `useGlobalsMenus` (memoized) and mounts `<GlobalsCommands>`; header toolbar untouched.

Deviations / notes
- `GlobalsCommands` returns a fragment, not literally `null` (it renders per-option command components).
- Added `allLabOptions` to globals.ts (shared `withApp` with `labOptions`), `useLabGlobals` exported.
- `@weasel-js/prefs` was not reachable from forge: added as a dependency in forge/package.json and package-lock.json. `check:imports` passes on the node.
- `Workshop` function hit 123 lines (cap 120); extracted `useDocumentTitle` and `useGlobalsMenus`. `check:size` passes.

TDD
- RED 1 (module missing): `npx vitest run --project=forge .../globalsMenu.test.tsx` -> "Failed to resolve import ./globalsMenu".
- RED 2 (GlobalsCommands unmounted): 2 of 4 failed, `Unable to find role="menuitem" and name "Theme"`.
- GREEN: same command, 4/4. Full `packages/forge/src/shell` on teitou: 25 files, 255 tests pass. Typecheck, eslint on shell, check:imports clean.

Files: globalsMenu.tsx, globalsMenu.test.tsx (new); GlobalsToolbar.tsx, globals.ts, Workshop.tsx, forge/package.json, package-lock.json; .changeset/forge-globals-menu.md (patch).

## Fix round 1

- Globals are values now: per declaration a submenu `globals.d<n>` holding one `pref.enum` leaf `v` (path `globals.d<n>.v`; the extra submenu level keeps each declaration's name over its radio rows). `globalsMenu(declarations, values, set)` returns `LabMenus` with `values` keyed by leaf path and an `onChange` mapping path back to `set(key, value)`. Enum rows render as `menuitemcheckbox` rows (confirmed by the existing labkit "binds a declared menu's enum" test and the new tests).
- Values live inside the lab (`usePersistedState`, lab scope), Workshop sits above `<Lab>`, so `GlobalsMenus` (a Lab child) reports the `LabMenus` to Workshop state via `onMenus`, as `LabGlobals` does. `GlobalCommand`/`GlobalsCommands`/`useGlobalsMenus` and `allLabOptions` deleted; `globals.ts` is back to its original `labOptions`. Options come from `labOptions(declaration, values)`, the header's own.
- Test imports merged. `@weasel-js/prefs` still needed (`pref`): dependency kept. Changeset prose still accurate, unchanged.
- RED: with options temporarily from `declaration.options`, 4 of 6 failed (structure/App-first, hidden option, shows hides, active stays selected after a `shows` change); restored, 6/6 pass.
- Ran on teitou: forge `packages/forge/src/shell` 25 files / 257 tests pass; labkit `packages/labkit/src/lab` 30 files / 224 pass; typecheck, check:imports, eslint (shell) clean; check:size clean.
