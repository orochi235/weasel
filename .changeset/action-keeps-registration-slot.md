---
'@weasel-js/routing': patch
---

An action re-registered in the same tick keeps its place in registration order. `useAction` releases and registers whenever its action object changes, which used to move the action to the back, so of two actions tied on a key the winner could flip after a re-render.
