---
"@weasel-js/prefs": patch
"@weasel-js/ui": patch
---

A field has a bar form. `BarField` takes the props `PropertyField` takes and draws the field as a cell of a toolbar: a number or a text box behind its name, a flag as a button held down while on, a paint as its swatch, a radio group as segments. `BarPopover` is the cell for what one line cannot hold, a button that opens a popover; a text area draws through it.

`ToolOptionsBar` draws its schema's leaves through `BarField`, which changes three of them. A boolean with no `control` is a toggle button where it was a switch. A paint is a swatch that opens its editor where it was the editor inline. A leaf whose value is made of others (`object`, `list`, `map`, `union`) is a button that opens its rows where it drew them on the line. A string's box is `12ch` wide where it was `5ch`.

An enum takes `control: 'menu'`: a button reading the current value, as wide as that value. `PropertyField` and `PropertyControl` draw it, `PrefEnumControl` allows it, and `PrefSchemaEditor` offers it. `MenuButton` gains `current`, which draws its label as a value and not as a prompt.
