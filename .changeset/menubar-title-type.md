---
'@weasel-js/ui': patch
---

`MenuBar` titles take the theme's foreground color and the UI font at the small size and the bold weight, the same as `Bar`'s labeled buttons, which now state that weight rather than taking the browser's button default, instead of inheriting both from the page. On a page whose own text color belonged to the other mode, the titles read as disabled.
