---
"@weasel-js/ui": patch
---

`Switch`, `Checkbox`, and `RadioGroup`'s radios now contain the visually hidden input React Aria renders inside each. It was positioned against the page rather than its control, so a control inside a scrolling pane left its input behind at the control's place in the pane's full height, and the page grew a scroll as tall as the pane's content.
