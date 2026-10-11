---
'@weasel-js/ui': patch
---

Three fixes to the key marks in `Timeline`'s lanes. Clicking a key to select it no longer calls `onChange`: a press that travels less than the drag threshold commits no move, where it used to commit one on every click and, with Alt held, shift the key to the click's exact millisecond. An arrow key that carries a key past its neighbor keeps focus on the moved key, so the next press moves the same key rather than the one that took its place; Enter and Space on a focused key now select it. Double-clicking a key no longer inserts a second key on top of it.
