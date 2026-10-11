---
'@weasel-js/routing': patch
---

A pinch whose two fingers moved apart evenly ended with a `multiTouchTap`, because the tap test looked only at how far the midpoint between the fingers had traveled. A binding such as two-finger-tap-to-undo fired after every centered zoom. A tap now also requires that no finger moved more than 8 px from where it landed.
