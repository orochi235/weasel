---
'@weasel-js/routing': patch
---

Internal: `useGestureDispatcher`'s keyboard, wheel, WebKit pinch, contextmenu, and drop and paste handling each moved to a module of their own around a shared routing core, and its option types moved beside them. Everything the file exported is still exported from it. No behavior change.
