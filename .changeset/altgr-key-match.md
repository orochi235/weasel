---
'@weasel-js/routing': patch
'@weasel-js/core': patch
---

Fixes: a key typed with AltGr could not match a key binding. A layout that types `[` with AltGr reports Ctrl and Alt held with it, and the strict modifier match read that as a chord. The dispatcher still tries the chord as reported first, so a binding that names Ctrl+Alt keeps it; when nothing takes it and the browser reports AltGraph, it tries again without Ctrl and Alt. A key that reports its own letter or digit is left a chord, because Firefox on Windows reports AltGraph for a plain Ctrl+Alt as well. Checked in jsdom only, not on a Windows browser.
