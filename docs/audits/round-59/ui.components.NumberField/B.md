I couldn't write `.skulkr/out/findings.md` because the permission was denied, so here is the whole findings document.

## A step that lands on the previewed value never commits it: `spin` compares against the live `value`, not where typing began
- where: packages/ui/src/components/NumberField/useUnitTyping.ts:66 (spin)
- scenario: The caller previews through `onInput` (it sets `value` from it and commits on `onChange`), with `maxValue={100}` and value 50.
  1. Type `100`. This sends `onInput(100)`, and the caller's `value` becomes 100.
  2. Press End, or ArrowUp, which clamps to 100.
  3. `spinKey` returns 100 and `spin` sends `onInput(100)`. Because `next !== value` is false, it sends no `onChange`.
  4. `spin` also sets `typing.current = null` and clears the draft, so the blur that follows commits nothing either.

  The caller is left holding a preview of 100 that was never committed. `commitTyped` and the idle settle were fixed (c1577107ce) to compare against `typing.from`, but `spin` still compares against `value`.
- evidence: read
- severity: medium

## An offset typed after a previewed number applies to the preview, not to the value typing began from
- where: packages/ui/src/components/NumberField/useUnitTyping.ts:93 (leave)
- scenario: The caller previews through `onInput`, and the value is 10.
  1. Type `3`. This sends `onInput(3)`, the caller's `value` becomes 3, and `typing.sent` is true.
  2. Edit the text to `+=3` and blur.

  Without `onOffset`, `commitTyped(value + by)` commits 6 (3+3) instead of 13 (10+3). With `onOffset`, `onOffset(3)` fires but nothing calls `onInput(typing.from)` to undo the preview, so the caller adds the offset to its previewed 3. The offset path uses the live `value`, while `commitTyped` uses `typing.from`.
- evidence: read
- severity: low

## The wheel blocks page scrolling over a focused field that cannot step
- where: packages/ui/src/components/NumberField/UnitField.tsx:252 (useWheelSteps)
- scenario: A UnitField is focused but cannot step: it is read-only (still focusable, with `refuses` true), or it is already at the bound the wheel is heading for. `onWheel` calls `e.preventDefault()` before calling `spin`, and `spin` returns false. The page under the pointer stops scrolling while the field doesn't change. It should prevent the default only when `spin` actually stepped, as `fieldKey` does for keys.
- evidence: read
- severity: low

## Files read
packages/ui/src/components/NumberField/NumberField.module.css
packages/ui/src/components/NumberField/NumberField.stories.module.css
packages/ui/src/components/NumberField/NumberField.stories.tsx
packages/ui/src/components/NumberField/NumberField.tsx
packages/ui/src/components/NumberField/Steppers.tsx
packages/ui/src/components/NumberField/UnitField.stories.tsx
packages/ui/src/components/NumberField/UnitField.tsx
packages/ui/src/components/NumberField/index.ts
packages/ui/src/components/NumberField/useStepRepeat.ts
packages/ui/src/components/NumberField/useUnitTyping.ts

<!-- done: 3 findings, files read: 10 -->