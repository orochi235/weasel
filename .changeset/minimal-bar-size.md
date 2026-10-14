---
'@weasel-js/ui': patch
---

`size` now sets the font size of a `minimal` `ToggleBar`, `ButtonBar`, and `OptionsBar`, as it does under the other variants. Breaking in appearance: a `minimal` bar given no `size`, or `md`, draws its labels at the UI font size where it drew them at the `sm` size. Pass `size="sm"` to keep the old look.
