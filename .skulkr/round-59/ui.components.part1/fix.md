ColorChip drops a pick whose input and change land in one task (A): fixed 4509c42ca8

Checkbox held disabled for a reason draws its box as enabled (A): fixed 6b4a0ae1b5 (one stylesheet, so the boolean property row is fixed too)

CheckboxGroup `control="switch"` shows a mixed item as off (A): fixed baccd42d37 + 075418ff26 (`Switch` gains `indeterminate`; the `aria-checked="mixed"` call is recorded in `docs/unruled.md`)

Toggling `sweep` remounts every box (A): not a defect (React reads an unkeyed top-level Fragment as its children array and reuses the first child; a test showed the same input node keeping focus before any change)

ActionSettingsPopover ignores a `Disabled` scope (A): fixed 3cc375fc33

useActionStates' recheck ignores a reason-only change (A): not a defect (useSyncExternalStore's own post-commit snapshot check covers it, and a test caught up before any change; the recheck now uses the snapshot's key anyway, 9591c8f31c, no changeset)

ActionButton drops a caller's `style` when `grade` is set (B): fixed 872a75b502

ColorChip sends no end signal for an unmoved pick after `onInput` ticks (B): fixed 1618e920b5 (ColorField's `onCancel` now fires for it and `picked` clears; the call is recorded in `docs/unruled.md`)

Checkbox held disabled for a reason is not dimmed (B): duplicate of A's Checkbox finding

CheckboxGroup switch draws a mixed item as off (B): duplicate of A's CheckboxGroup finding

useActionStates' recheck misses a reason-only change (B): duplicate of A's useActionStates finding

ActionSettingsPopover ignores a `Disabled` scope (B): duplicate of A's ActionSettingsPopover finding

Extra: none. 3e3efdc163 shortens two of my changeset titles that `check:changesets` rejected, and b00b45560b fixes a type error in my new test that `typecheck` caught.

Checks:
- `npx vitest run --maxWorkers=1`, one file at a time: ActionButton.test.tsx 13 passed; ActionSettingsPopover.test.tsx 3 passed; useActionStates.test.tsx 1 passed; ActionBar.test.tsx 27 passed; Checkbox.skin.test.tsx 6 passed; Checkbox.test.tsx 8 passed; CheckboxGroup.test.tsx 9 passed; Switch.test.tsx 6 passed; ColorField.test.tsx 18 passed; PropertyField.test.tsx 42 passed. Unrun: none of the changed files is a browser test.
- `npm run checks:gate`: "checks:gate: all 32 passed". The first run failed typecheck and typecheck:packages on the test type error; fixed in b00b45560b, then rerun.
- `npm run check:changesets`: "[changesets] OK — 3038 changeset(s)."
- `npm run lint -w @weasel-js/ui`: not run. `@weasel-js/ui` has no `lint` script, so npm errored. I ran `npx eslint` on every changed .ts/.tsx file instead: exit 0.
- The tree is clean apart from `.skulkr/`.

tally: 8 of 12 fixed, 0 extra fixed