---
'@weasel-js/ui': patch
---

A non-modal `Callout` no longer traps focus. React Aria's `Dialog` contains focus wherever it is mounted, so clicking an input elsewhere on the page focused it for an instant and then pulled focus back to the callout's close button, sending typing nowhere. A non-modal callout now renders a plain `role="dialog"` instead; modal callouts still contain focus, and the close button and Escape still call `onDismiss`.
