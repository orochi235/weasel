---
'@weasel-js/hud': patch
---

Text typed into a HUD menu text row stays inside the row's value column: past its width it scrolls to keep the caret in view and is clipped, rather than drawing over the label and out of the panel.

<!-- entry: fix visual -->
