---
'@weasel-js/routing': patch
'@weasel-js/core': patch
---

`ActionVariant` and `ActionDisabledReason` are now public API, no longer tagged `@experimental`. `useCommand`'s `variants` option takes `ActionVariant`s, so a command's variants can carry `tags`; the unreleased `CommandVariant` type is gone.
