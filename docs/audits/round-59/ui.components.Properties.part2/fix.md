Auto toggle works inside a read-only scope (A+B): fixed 4107ad468e

Color row's error message drawn over its opacity track or stacked swatch (A+B): fixed 18de173956 (its browser test is unrun here)

Textarea or slider readout disabled with a reason isn't dimmed (A): fixed b49fe40e5a (its browser test is unrun here)

Stacked slider's help never opens from the keyboard, and its description sits on the untabbable track (A): fixed 76e6651d28

Read-only color field drops an `alpha` held apart from the hex (A): fixed d454dfb2b1

Read-only field's value can't be selected in Safari (A): fixed 511f9656a2. A sweep test now requires `-webkit-user-select` beside every `user-select` in the Properties stylesheets.

Debounced string field sends Escape's restored `onInput` after `onCancel` (B): fixed 2e88ee48ff

Debounced string field's idle commit reaches `onChange` before its last `onInput` (B): fixed 0651307668

Read-only font weight reads `700` where the select reads `700 Bold` (B): fixed c65de30639

Read-only `unset` color still shows a swatch and hex (B): fixed 678f49ceac. Every kind's readout now shows the dash while `unset`.

Row keeps measuring its old root after `group` changes, and misses a replaced control (B): fixed 18aee35acd

Extra defects: none.

Checks:
- `npx vitest run --maxWorkers=1`, one file at a time:
  - `Properties.styles.test.ts`: pass (4)
  - `PropertyField.textWait.test.tsx`: pass (2)
  - `PropertyReadout.test.tsx`: pass (7)
  - `PropertyRow.autoDisabled.test.tsx`: pass (3)
  - `PropertyRow.help.test.tsx`: pass (15)
  - `PropertyRow.multiline.test.tsx`: pass (2)
- Neighboring files I didn't edit also pass: `PropertyRow.auto`, `.render`, `.error`, `PropertyGroup`, `PropertyField`, `PropertyMetrics`, `.textEscape`, `.idleSettle`, `.settle`, `.noValue`, `.slider`, `rowHelp.press` and `rowHelp.kitSettings`.
- Unrun (browser tests can't run here): `PropertyField.disabled.browser.test.tsx` and `PropertyRow.error.browser.test.tsx`.
- `npm run checks:gate`: "checks:gate: all 32 passed". The first run failed on `check:size` and `lint` in `PropertyRow.tsx`; I fixed both and folded the fixes into their own commits.
- `npm run check:changesets`: OK.
- `npm run lint -w @weasel-js/ui`: there is no such script, because `@weasel-js/ui` defines no `lint`. The root `lint`, which covers `packages`, passed inside the gate.
- The tree is clean.

tally: 13 of 13 fixed, 0 extra fixed