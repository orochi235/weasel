---
'@weasel-js/ui': patch
'@weasel-js/labkit': patch
'@weasel-js/theme': patch
---

`Disclosure` draws a 13px dark violet rounded square holding a white `+` while its
section is shut and a `−` while it is open, in place of the turning triangle.
`--wzl-disclosure-fill` recolors it.
`DisclosureMark` is the same mark on its own, for a row that is itself the
control; `SidebarPanel` and `Timeline` lanes now use it. `Disclosure`'s
`direction` prop and the `DisclosureDirection` type are gone, since the mark no
longer points.

`Badge` now honors its size: a `font: inherit` declared after its
`font-size` had reset every badge to its parent's font size.
