---
'@weasel-js/ui': patch
'@weasel-js/labkit': patch
---

A `Dialog` that mounts with `isOpen` already true no longer leaves the page inert. Its first render portalled into the body before the overlay found its themed host, and React Aria marked everything outside it `inert` — including the app root the dialog then moved into, so nothing in it took a click or a key. Every weasel overlay (`Dialog`, `Callout`, `Tooltip`, the `Select`, `ComboBox`, `MenuButton` and `PaintField` popovers, labkit's `ControlMatrix`) now renders only once its portal host is known, still before paint.
