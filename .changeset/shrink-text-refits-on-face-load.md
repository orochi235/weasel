---
'@weasel-js/text-tools': patch
---

A `fit: 'shrink'` text node painted before its font loaded is refitted once the face arrives, instead of keeping the size it had under the fallback.

<!-- entry: fix visual -->
