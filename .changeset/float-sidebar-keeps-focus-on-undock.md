---
'@weasel-js/labkit': patch
---

Undocking a section from a floating trial sidebar keeps focus in the panel, so Escape still closes it.

Before, the undocked section took its focused button with it and focus fell to the page, where the panel's Escape never heard it.

<!-- entry: fix -->
