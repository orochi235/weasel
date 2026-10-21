---
"@weasel-js/routing": patch
---

A keymap entry's `overlay` now draws while that keymap is the innermost one open, and stops when it
closes. Before, `useContributions` assembled overlays without the open keymap, so a keymap's overlay
never drew.
