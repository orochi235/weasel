Draws a test read from its group (`from: 'group'`) with its comparison and value controls, names its pref as the group's, and keeps it reading the group through edits (A): fixed ff9b22d361

A `readout` number pref's compared value is drawn read-only (A+B): fixed 90f3e9b665. The value field no longer takes the pref's `readOnly` or its `onClear`. A said a clear button shows; that is not a defect: `onClear` here is what happens when the field is emptied, and no button is drawn.

The clipboard's status message never clears (A+B): fixed 746fd677a9. It now shows only while the condition is the one it was said about.

A refused clipboard read is reported as "holds no condition" (A, part of the finding above): fixed f3d950e7c6. It now says "The clipboard could not be read."

A malformed condition gets no Paste (A): fixed 55dcc3d41d

Rows keyed by index hand a removed row's state to the next row (A): not a defect. Every control in a row takes its value from the row. The only state a row keeps for itself is a number being typed or an open list, and the blur or press it takes to reach another row's Remove commits or closes it first. Inferred from reading the code, not run.

`exclude` never reaches an entry's own fields (B): fixed e31b40084d. A path through an entry (`phases.*.mode`) now also leaves out the entry field it names after its last `*`, and the `exclude` doc says so.

Duplicates: B's readout finding is the same as A's readout finding, and B's clipboard finding is the same as A's clipboard finding.

Each fix has its own test, and each test failed before its fix. Each consumer-visible fix has its own changeset.

Checks:
- `npx vitest run --maxWorkers=1 packages/prefs-editor/src/PrefConditionEditor/PrefConditionEditor.test.tsx`: pass (38 passed)
- `npx vitest run --maxWorkers=1 packages/prefs-editor/src/PrefSchemaEditor`: pass (441 passed)
- `npm run checks:gate`: pass (all 32 passed)
- `npm run lint -w @weasel-js/prefs-editor`: no such script in that package. I ran `eslint packages/prefs-editor/src/PrefConditionEditor` instead: pass (exit 0)
- `npm run check:size`: pass
- `npm run check:changesets`: pass

tally: 6 of 8 fixed, 0 extra fixed