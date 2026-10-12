---
'@weasel-js/hud': patch
---

Adds API: the rect and image widgets take a `claims` option and a `setClaims(claims)` setter, so one that is decoration in one mode can consume presses in another without being swapped out. The default is still `[]`. A rect that claims `pointer` is a scrim: a press on it no longer reaches the widgets or the scene beneath.

`Widget.claims` was already read at every hit-test, so a hand-written widget can declare it as a getter; its doc now says so and a test holds it.
