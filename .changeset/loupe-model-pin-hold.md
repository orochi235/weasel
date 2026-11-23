---
'@weasel-js/loupe': minor
---

A loupe model reports the content point its pin holds as `pin`, and `holdPin` puts a pin back on it after the camera has moved.

```ts
const held = loupe.pin;     // null while the aim follows
// … the pin is dragged elsewhere, the camera pans …
if (held) loupe.holdPin(held);
```

<!-- entry: api -->
