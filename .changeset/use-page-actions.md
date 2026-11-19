---
'@weasel-js/routing': minor
'@weasel-js/core': minor
---

`usePageActions(actions, enabled?)` binds actions' keys on the page with no provider above it

It owns its own actions registry and a dispatcher with no element, hearing keys as `keyboard: 'page'` does: after a focused widget's own handlers, and ahead of every dispatcher on `window`. A disabled action leaves its key to the rest of the page. For a hook or a page that has no actions registry to put its keys on.

<!-- entry: api -->
