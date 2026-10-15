---
'@weasel-js/labkit': patch
---

A trial's viewport controls are `@weasel-js/ui` ghost icon `Button`s, so each wears the kit's hover and pressed fills and names itself in a kit tooltip where it had a native `title`. Breaking for a host that styled them: the `lk-viewport-controls__button` class no longer exists.
