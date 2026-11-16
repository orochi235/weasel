---
'@weasel-js/registry': minor
---

`createKeyedEmitter` files listeners by key with `createEmitter`'s semantics, and forgets a key once its last listener leaves.

`subscribe(key, fn)` returns the unsubscribe, `emit(key, ...args)` calls the key's listeners, and `clear(key)` drops them all; an unsubscribe called twice or after a `clear` never removes a later subscription.

<!-- entry: api -->
