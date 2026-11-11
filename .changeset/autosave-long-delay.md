---
"@weasel-js/editor": patch
"@weasel-js/registry": patch
"@weasel-js/d3": patch
---

`useAutosave` waits out a `delayMs` past 2³¹ − 1 ms, the longest one timer holds, and an infinite one saves only on unmount or when the page goes away; both used to save at once. The wait is `after(ms, fn)`, new in `@weasel-js/registry`, which d3's transition delays now use too, and which editor and d3 now depend on.
