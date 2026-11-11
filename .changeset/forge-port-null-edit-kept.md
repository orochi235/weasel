---
"@weasel-js/forge": patch
---

A control edit that sets `null` under a key the frame port never carried is kept. Such a key holds, for example, a React element; the edit is no longer replaced by the original value.

<!-- entry: rank=-5 fix -->
