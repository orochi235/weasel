- Over-trigger nudge measured in client px but applied in the overlay frame's px, so it lands wrong under a scale or zoom (A): fixed 8265d1f76c. The viewport clamp now uses the frame's visible region too.
- A placeholder or `mixed` list can't flip above its trigger (A): fixed daf9422e81.
- The RTL crossOffset is computed against the wrong edge, and the default `--wzl-select-align` is `left` (A): fixed 194b74afeb. The default is now `start`, and `start`/`end` follow the text direction.
- The capture-phase pointerup swallow hides the opening release from the trigger's press (A): fixed dd6e5d917c. The trigger's press now ends with a `pointercancel` on the document. React Aria shows the trigger as pressed while the list is open on purpose (RAC `Select` passes `isPressed: state.isOpen`), so the visible symptom is a trigger still marked pressed after the list shuts. The test checks that.
- FitSizer reads a fragment of `SelectItem`s as one label (A): fixed 51466ca96d. `ComboBox` shares `FitSizer`, so it is fixed too. A custom component that renders `SelectItem`s can't be read without rendering it, and stays unread.
- `value`, `defaultValue`, `onChange` and `selectionMode` reach React Aria and override `selectedKey` (B): fixed 153ae4442f. They are dropped from the type and stripped at run time. The changeset is `major`/`breaking`, because code that passed them no longer typechecks.
- Adding or removing `tooltip`/`shortcut` remounts the trigger and drops focus (B): fixed 7845d1e7c7. `TriggerTooltip` now keeps the same wrapper either way.
- RTL list shifted sideways by the list/trigger width difference (B): duplicate of A's RTL finding, fixed 194b74afeb.
- A quick touch tap on the selected row right after opening is swallowed (B): fixed e1a949abc7. `Press` records `pointerType`, and the guard skips touch, which React Aria opens on release.
- `data-align` is never cleared when the list loses its selected row while open (B): fixed e40dc4087f.
- Option values `1` and `'1'` get the same React key (B): fixed 0d35ae5c60 as a strict call. React Aria itself keys rendered rows by `String(id)`: with the kit's key changed, it still warned "two children with the same key". So a `Select` whose option values read the same as text now throws a `RangeError`, with no override. Recorded in `docs/unruled.md`.

Found while fixing, not fixed: `ButtonTooltip` (`packages/ui/src/components/Tooltip/buttonTooltip.tsx`) still returns the bare button when there is no tooltip content. So a `Button` whose tooltip comes or goes remounts the same way. It is outside this area, and its `Focusable` wrapper changes the button's props, so it needs its own pass.

Checks:
- `npx vitest run --maxWorkers=1` on each touched or affected file: pass.
  - `Select/Select.test.tsx` 48/48
  - `Select/alignOverTrigger.test.tsx` 4/4
  - `Select/Select.popup.test.tsx` 2/2
  - `Select/Select.held.test.tsx` 5/5
  - `Tooltip/buttonTooltip.test.tsx` 3/3
  - `Tooltip/Tooltip.test.tsx` 11/11
  - `ComboBox/ComboBox.test.tsx` 23/23
- `npm run checks:gate`: pass ("checks:gate: all 32 passed").
- `npm run check:changesets`: pass.
- `npm run lint -w @weasel-js/ui`: not run, because the package has no `lint` script ("Missing script"). `npx eslint` on the changed Select and Tooltip files: pass, no output. The gate's root `npm run lint` also passed.
- The tree is clean.

tally: 11 of 11 fixed, 0 extra fixed