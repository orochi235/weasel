---
'@weasel-js/ui': patch
---

A `PropertyRow`'s ⓘ no longer takes a tab stop of its own, so Tab crosses a described row in one stop where it took two. The row's first control is described by the help's text (`aria-describedby`), so a screen reader reads it with the control. The tooltip opens when the keyboard brings focus to a control in the row, after the tooltip's usual delay, and closes on Escape or when focus leaves the row; a click on the control opens nothing, and hovering the ⓘ works as before. This reaches every surface that draws its rows with `PropertyRow`: `PropertyField`, `PrefsForm`, `SelectionPanel`, and labkit's `ControlPanel`.

Once a control carries the help, the ⓘ is drawn as a `<span>` hidden from assistive tech where it was a `<button>` named `About <label>`. As the first labelable element in the row's `<label>`, that button was the control the label named, so a bare control passed to a `PropertyRow` now takes its name from the row's label. A row with no focusable control keeps the ⓘ as a button and a tab stop, since nothing else can carry its help.

`PropertyHelp` used outside a row is unchanged unless given the new `carried` prop; `open` and `onOpenChange` let an owner open its tooltip.

**Breaking for a test that finds the ⓘ by `getByRole('button', { name: 'About …' })`:** in a row with a control it is no longer a button. Assert the control's accessible description.
