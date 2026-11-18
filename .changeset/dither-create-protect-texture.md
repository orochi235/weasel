---
'@weasel-js/dither': major
---

`protectTexture` is renamed `createProtectTexture`: it creates a GPU texture the caller disposes.

```ts
// before
const held = await protectTexture(mask, width, height);
// after
const held = await createProtectTexture(mask, width, height);
```

<!-- entry: breaking api -->
