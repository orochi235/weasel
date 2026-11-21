- Uncontrolled `mixed` NumberField loses what was typed (A): fixed edcdf75a34. With this React Aria version the typed value is kept, but the field does switch from uncontrolled to controlled and back, and React Aria warns "changed from controlled to uncontrolled". The field now keeps its own value when uncontrolled, so React Aria always sees a controlled field.
- Held stepper keeps its timer through a disable and steps by itself once re-enabled (A): fixed 954d701301. `spent` is now true while the field refuses input, so the hold ends on its own.
- Wheel blocks page scroll on a focused field that cannot step (A+B): fixed 6956ca5939. At a bound `spin` still returned true, so the wheel now checks `spent` as well as what `spin` returns.
- `spin` compares its step against the live value, not where typing began (B): fixed e81139eb1a.
- An offset after an `onInput` preview uses the preview and never sends the starting value back (A+B): fixed a578d483e3. The offset now adds to `typing.from`. With `onOffset`, `onInput(from)` is sent first. A commit that lands back where typing began also sends `onInput(from)`. I updated the `onInput` doc to match.

No extra defects found. Nothing needed a ruling in `docs/unruled.md`.

Checks:
- `npx vitest run --maxWorkers=1`: pass on every NumberField test file (`NumberField.ghost`, `NumberField`, `UnitField.clear`, `.endless`, `.field`, `.idle`, `.kitSettings`, `.locale`, `.offset`, `.pbt`, `.preview` (new), `UnitField`, `.wheel` (new)). Also pass on the files that render these components: `useFieldLocale`, `focusRefs`, `Field.controls`, `Field.chrome`, and `ControlSize`.
- Unrun: `ControlSize.browser.test.tsx`, which needs a browser.
- `npm run checks:gate`: "checks:gate: all 32 passed". The first two runs failed: an unused `act` import, then four changeset titles over 140 characters. Both were fixed in their own commits.
- `npm run check:changesets`: "OK — 3036 changeset(s)".
- `npm run lint -w @weasel-js/ui`: can't run, because `@weasel-js/ui` has no `lint` script. Root `npm run lint` passed inside the gate.
- Tree clean; `.skulkr/` is untouched and in no commit.

tally: 7 of 7 fixed, 0 extra fixed