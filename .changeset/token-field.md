---
'@weasel-js/ui': patch
---

New `TokenField`: a list edited as a wrapping row of chips with a text field after them. Enter or a comma adds what was typed, a click on a chip opens a popover that edits it, and with `reorder` chips drag into place across wrapped lines or move with Alt+Left / Alt+Right. Tokens are strings by default; `label`, `create` and `renderEditor` make them records, and `problem` flags one as invalid. This is additive.

`Badge` takes `labelProps`, attributes for the label of a removable badge that has an action, so a caller can handle a press or a key on the label itself.

The asset editor's enum options are now a `TokenField`: each option is a chip showing its label, its stored value on hover, and a popover edits both.
