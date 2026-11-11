---
"@weasel-js/gestures": patch
---

A press on a pointer the recognizer still holds cancels the stale press first (`pointercancel`) instead of replacing it silently.

<!-- entry: fix -->
