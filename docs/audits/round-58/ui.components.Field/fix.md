`invalid={false}` overrode the Field's error in the React Aria controls but not in UnitField (A): fixed 190d7e153f

An empty `label` or `description` (`null`, `false`, `''`) counted as present, unlike an empty `error` (A+B): fixed 030efc33e4. The same rule now also covers UnitField, the description under the boxed controls, and the boxed controls' own `label` (Input, TextArea, NumberField, ComboBox, Select, RadioGroup), so a control given an empty label inside a Field takes the field's label.

The Field's error painted every frame inside it red, including controls the hook leaves valid (B): fixed d1d309de53

The Field's label was a `<span>` that neither pointed at the control's id nor reached the control on click (B): fixed 37071cbc77. A `group` field keeps the `<span>`, since its members name themselves.

The story's `NativeInput` overwrote the consumer's own id and names (B): fixed c8228d6251. It is story-only, so there is no reproducing test and no changeset.

Empty label/description, as reported by B: duplicate of the A finding above.

No extra defects found.

Checks:
- `npx vitest run --maxWorkers=1` on each touched test file: Field.test.tsx pass (15), Field.controls.test.tsx pass (39), Field.chrome.test.tsx pass (13).
- Same run on the 19 test files of the changed controls (Input, TextArea, ComboBox, Select, NumberField/UnitField, RadioGroup): all pass.
- `npm run typecheck:packages -- ui`: failed once on a test typing, then fixed. The gate's typecheck passes.
- `npm run checks:gate`: first run failed `check:changesets` (three titles over 140 characters). I fixed them and squashed each fix into its own commit. Rerun: "all 32 passed".
- `npm run lint -w @weasel-js/ui`: not run, because the ui package has no `lint` script (npm error). In its place, `npx eslint` on the changed files passes and `check:size` passes.
- No browser tests touched.
- The tree is clean apart from `.skulkr/`.

tally: 5 of 6 fixed, 0 extra fixed