---
'@weasel-js/core': major
---

`registerContentHandler` throws when a different handler is registered under an `id` already registered, unless it passes `{ replace: true }`.

This is breaking: both handlers used to stay registered, and the older one kept winning. The same entry registered again is still a second registration. Code that swaps a handler on purpose says so:

```ts
registerContentHandler(handler, { replace: true });
```

<!-- entry: breaking api behavior -->
