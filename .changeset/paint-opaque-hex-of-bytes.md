---
'@weasel-js/paint': major
---

`rgbaHex` is renamed `opaqueHexOfBytes`: it reads 0..255 bytes and drops alpha, where `rgbaToHex` reads 0..1 floats and keeps it.

```ts
// before
const hex = rgbaHex(pixel);
// after
const hex = opaqueHexOfBytes(pixel);
```

<!-- entry: breaking api -->
