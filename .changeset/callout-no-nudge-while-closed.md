---
'@weasel-js/ui': patch
---

A `Callout` held shut with `isOpen={false}` no longer dispatches a `resize` on `window` each time its `anchorRect` changes. It still does while open, which is what moves the popover with its anchor.
