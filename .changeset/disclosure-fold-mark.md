---
'@weasel-js/ui': patch
'@weasel-js/labkit': patch
---

`Disclosure` draws a violet rounded square holding a white `+` while its
section is shut and a `−` while it is open, in place of the turning triangle.
`DisclosureMark` is the same mark on its own, for a row that is itself the
control; `SidebarPanel` and `Timeline` lanes now use it. `Disclosure`'s
`direction` prop and the `DisclosureDirection` type are gone, since the mark no
longer points.
