---
'@weasel-js/core': patch
---

`useKeybindings`: changing the `disable` option after mount had no effect until the tool set also changed, so the tool keys stayed live when it turned on and stayed off when it turned back. The keys now register and unregister as `disable` changes.
