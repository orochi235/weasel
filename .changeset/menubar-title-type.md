---
'@weasel-js/ui': patch
---

`MenuBar` titles set their own color and type instead of inheriting them from the page: the theme's foreground, and the UI font at the small size and bold weight, matching `Bar`'s labeled buttons. On a page whose text color came from the other mode, the titles had read as disabled. `Bar`'s buttons now state that weight too, where before they took the browser's button default.
