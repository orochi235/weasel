---
'@weasel-js/ui': patch
---

`useHeldKeys` keeps a key held through a tap of Win or Super off Apple platforms.

Only on macOS, which sends no key-up for a key let go while Command is down, does letting go of Command let go of the rest.

<!-- entry: fix -->
