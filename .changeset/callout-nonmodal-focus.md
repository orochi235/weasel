---
'@weasel-js/ui': patch
---

A non-modal `Callout` no longer traps focus or takes it when it opens. React Aria's `Dialog` contains focus wherever it is mounted, so clicking an input elsewhere on the page focused it for an instant and then pulled focus back to the callout's close button, sending typing nowhere. A non-modal callout now renders a plain `role="dialog"` and, like React Aria's own non-modal popovers, leaves focus where it was when it opens, so Escape reaches it once focus is inside. Modal callouts still take and contain focus, and the close button and Escape still call `onDismiss`.
