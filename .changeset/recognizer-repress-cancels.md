---
"@weasel-js/gestures": patch
---

A press on a pointer the recognizer still holds cancels the stale press first (`pointercancel`), as a lost release, instead of replacing it silently.
