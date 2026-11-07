---
'@weasel-js/core': patch
'@weasel-js/animator': patch
---

`@weasel-js/core` and `@weasel-js/animator` take `@msb235/blits` as a peer dependency at `^1.1.0` instead of a dependency pinned at exactly `1.1.0`. An app on any blits 1.x from 1.1.0 up now shares its own copy with weasel instead of getting a second one nested inside it. npm installs the peer automatically; an app that installs blits itself keeps the version it chose.
