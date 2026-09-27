---
'@weasel-js/routing': patch
'@weasel-js/core': patch
'@weasel-js/labkit': patch
---

A keystroke is dispatched once. Every gesture dispatcher listens for keys on
`window`, and one now skips a keydown that another dispatcher — or anything
else — has already claimed with `preventDefault`; before, two dispatchers
binding the same key both ran it. `keyboard: 'first'` makes a dispatcher listen
in the capture phase, ahead of the rest whatever the mount order. The lab
header's zoom uses it, so Mod+= over a trial with a camera zooms the trial and
not also a story's own canvas; over a trial without one, the key passes to the
story.
