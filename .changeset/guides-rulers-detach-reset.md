---
'@weasel-js/guides': patch
---

`<Rulers>` stops drawing a canvas once its rulers are detached from it. Detaching clears their view, size, pointer and draft guide, and notifies subscribers.

<!-- entry: fix -->
