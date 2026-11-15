---
'@weasel-js/routing': patch
'@weasel-js/core': patch
'@weasel-js/kernel3d': patch
---

An augmentation of `DepSchema` or `ActionParamSchema` against `'@weasel-js/routing'` merges in every program, kernel3d's own included.

Augment `'@weasel-js/routing'`, which declares both, and list it among your dependencies. An augmentation of core's re-export merges into a separate copy, so lint now rejects one.

```ts
// before
declare module '@weasel-js/core' { interface DepSchema { color: ColorApi } }
// after
declare module '@weasel-js/routing' { interface DepSchema { color: ColorApi } }
```

<!-- entry: fix -->
