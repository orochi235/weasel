I couldn't write `.skulkr/out/findings.md` because permission was denied, so the whole findings document is below.

# Audit round 59 — ui.components.NumberField

## A held stepper keeps its repeat timer through a disable, and resumes stepping by itself when the field is re-enabled
- where: packages/ui/src/components/NumberField/Steppers.tsx:20 (Steppers / Stepper), with packages/ui/src/components/NumberField/useUnitTyping.ts:73 (`spent`)
- scenario: Hold a `UnitField`'s Increment stepper, and while it is held the caller sets `disabled` or `readOnly` (for example, it locks the field while an `onChange` save is in flight). The `<button>` turns `disabled`, so in browsers that don't send pointer events to a disabled control (Firefox), `pointerup` and `pointerleave` never arrive and `repeat.stop` never runs. `createStepRepeat` ends a hold only when `spent(k)` is true, and `spent` is `!canSpin(key, from(), bounds)`, which ignores `disabled`. While disabled, `spin` returns false, so the 60 ms timer keeps rescheduling and does nothing. When the field is enabled again, with no button held, the next tick's `spin` succeeds and the value climbs every 60 ms. It stops only when a stepper is pressed and released or the field unmounts. `spent` should be true while the field refuses input, or the hold should stop when `disabled` turns on.
- evidence: read
- severity: medium

## NumberField `mixed` makes an uncontrolled field controlled, so a value typed while mixed is lost and the old default comes back
- where: packages/ui/src/components/NumberField/NumberField.tsx:85 (NumberField, `value={mixed ? NaN : rest.value}`)
- scenario: `<NumberField defaultValue={5} mixed onChange={…} />`. While `mixed`, React Aria gets `value={NaN}` and treats the field as controlled, so its internal state ignores what is typed. The user types 7 and commits: `onChange(7)` fires, but the internal value stays 5. The caller then clears `mixed`, `value` goes back to `undefined`, and React Aria switches to uncontrolled with a warning. It then shows its internal state, so the field displays 5 although the caller just received 7. Mixed on an uncontrolled field should not switch control modes.
- evidence: read (React Aria's `useControlledState` updates its internal state only while uncontrolled; node_modules isn't in the tree, so this is from React Aria's known behavior, not its source here)
- severity: medium

## An offset committed after an `onInput` preview never sends the starting value back
- where: packages/ui/src/components/NumberField/useUnitTyping.ts:93 (useUnitTyping `leave`), and :115 (commitTyped)
- scenario: The value is 10 and the caller previews it live through `onInput`.
  - The user types `5`, which sends `onInput(5)` and sets `sent`. They then type `+=` before it, making `+=5`, and press Enter.
  - With `onOffset` given, `leave` calls `onOffset(5)` and never sends `onInput(10)`. The caller's live value stays at the abandoned preview 5.
  - Without `onOffset`, typing `+=0` gives `commitTyped(10)`, which sees `next === typing.from` and sends neither `onChange` nor `onInput`. The preview stays at 5 while the field shows 10.
  
  This breaks the `onInput` doc's promise that typing which does not end in a value sends back the value it began from.
- evidence: read
- severity: low

## The wheel on a focused read-only or held UnitField blocks page scroll without stepping
- where: packages/ui/src/components/NumberField/UnitField.tsx:254 (useWheelSteps)
- scenario: A `UnitField` that is `readOnly`, or disabled with a `disabledReason`, can still take focus. With it focused, a wheel notch calls `e.preventDefault()` before `spin`, and then `spin` refuses because the field refuses input. The page doesn't scroll and the value doesn't change. `preventDefault` should run only when `spin` actually stepped, as `fieldKey` does for keys.
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

<!-- done: 4 findings, files read: 10 -->