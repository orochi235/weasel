---
"@weasel-js/core": patch
---

`usePointerStylus` no longer drops the first pointer move when it arrives within
`1000 / maxFps` ms of the page's time origin. The throttle measured that first
move against a last-commit time of zero rather than "never". A bug fix; nothing
else about the throttle changes.
