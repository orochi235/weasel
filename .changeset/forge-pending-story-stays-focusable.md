---
'@weasel-js/forge': patch
---

A story waiting on its first paint is held at `opacity: 0` with pointer events off, where it was also `visibility: hidden`. Hidden that way, nothing in it could take focus, so react-aria logged "`<Focusable>` child must be focusable" once for every `Focusable` a story mounted, such as the ⓘ of a `PropertyRow` with help.
