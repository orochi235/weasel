---
'@weasel-js/labkit': patch
'@weasel-js/ui': patch
'@weasel-js/prefs': patch
---

`ControlPanel` writes a typed number or text once, when the edit settles on Enter or blur, so one typed value is one undo step; Escape writes nothing. This changes what a panel with no `draftConfig` does: it used to write every keystroke. The new `draftConfig` prop takes the values an edit passes through, a typed field's keystrokes and a slider's drag, so an instrument can follow the edit while `setConfig` hears only the settled value. A lab's Settings panel passes one, and still updates as you type.

A `.dialog()` row and a compound leaf's dialog now edit a draft: Done writes it once, and the new Cancel button, Escape, or a press outside the dialog drops it. `DialogRow` takes `onOpen`, `onDone`, and `onCancel` for this; given `onCancel`, it draws Cancel beside Done.

A `.resettable()` group's reset writes the group's whole value at its own path, once, rather than one write per changed leaf.

A number can be cleared: `f.number(4).clearable()` writes `undefined` when its field is emptied and left, and `f.number()` with no default starts unset. `.placeholder()` says what an empty field stands for, and `.min()` and `.max()` bound a number on one side. Underneath, `PrefNumber` gains `clearable`, and the number `PropertyField` and `UnitField` take `onClear`.

`PropertyRow`, `PropertyField`, and `DialogRow` take `error`, a validation message drawn under the control as an alert. `ControlPanel` takes `errors`, keyed by path, and a custom row gets its own as `ctx.error`.

A `showIf` or `enableIf` comparing an enum with a string none of its options is no longer throws out of `resolveConfigSchema`: it warns in development and never matches. `checkPrefCondition` reports it under a new code, `option`.

A section or group whose rows are all hidden no longer draws its heading.

A text `PropertyField` drops its draft on Escape and gives `onInput` back the value typing began from.
