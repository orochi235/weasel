---
'@weasel-js/ui': patch
---

`ToggleBar` draws from the stylesheet `ButtonBar` and `OptionsBar` share, where it kept its own copy of the segmented-control rules. Nothing it draws moves: its computed styles and boxes are the same in every variant, size, and mode. The three stay three components, since a segment is a radio, a toggle, or a momentary button; that call was made on an agent's judgment.

Adds API: `ButtonBar` and `OptionsBar` take `variant="flat"`, the outlined cells `ToggleBar` already drew.
