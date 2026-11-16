---
'@weasel-js/font': major
---

`registerFont` throws when a variant already registered is registered again with other URLs, unless the call passes `{ replace: true }`.

Calls that used to keep the first URLs in silence now throw, naming the family, the variant and both pairs of URLs. Registering the same URLs again is still a no-op. To swap in another atlas:

```ts
registerFont('Inter', {}, '/b.json', '/b.png', { replace: true });
```

A replaced variant that has loaded, or is loading, fetches the new files, and a lazy one fetches them when first used.

<!-- entry: breaking api -->
