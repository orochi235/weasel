---
'@weasel-js/ui': patch
'@weasel-js/labkit': patch
---

A `PropertyRow`'s ⓘ no longer takes focus, by Tab or by a press, so Tab crosses a described row in one stop where it took two and lands on the row's control. The row's first control is described by the help's text (`aria-describedby`), so a screen reader reads it with the control. The tooltip opens when the keyboard brings focus to a control in the row, after the tooltip's usual delay, and closes on Escape or when focus leaves the row; a click on the control opens nothing, and hovering the ⓘ works as before. This reaches every surface that draws its rows with `PropertyRow`: `PropertyField`, `PrefsForm`, `SelectionPanel`, and labkit's `ControlPanel`. A row with no focusable control has hovering as the only way to its help.

In a row the ⓘ is drawn as a `<span>` hidden from assistive tech where it was a `<button>` named `About <label>`. As the first labelable element in the row's `<label>`, that button was the control the label named, so a bare control passed to a `PropertyRow` now takes its name from the row's label.

`PropertyHelp` used on its own is unchanged, a button and a tab stop, unless given `within`: a selector for the ancestor that is its row. labkit's `ControlMatrix` passes `within="tr"`, so a matrix row's help rides on that row's first cell.

**Breaking for a test that finds a row's ⓘ by `getByRole('button', { name: 'About …' })`:** it is no longer a button. Assert the control's accessible description.
