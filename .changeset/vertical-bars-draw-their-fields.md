---
"@weasel-js/ui": patch
"@weasel-js/theme": patch
---

A vertical `Bar`, and a `Bar` along a shape, now draw each field the way a horizontal bar does, instead of opening
every field but an action from a dropdown. Only a group that opens, a text area, and a field made of other fields
still drop down. In a vertical bar a field's parts stack and stay upright: a box sits under its name, a switch or a
checkbox above its words, a segmented control runs top to bottom, and a slider stands on end. `ToggleBar` takes an
`orientation`, and every segmented row follows the new `OrientationContext` when it sets none. `BarLayout` no longer
takes `row`.

Every control on a bar now stands at one height, so boxes, selects, segments, dropdown buttons and action buttons
line up; action buttons are 24px square rather than 32px, and show a pointer. A bar's label is set like a field
label, in capitals, one weight heavier. A flat segmented control draws the same border a text box does, and the
default `--wzl-field-border` is a little stronger.
