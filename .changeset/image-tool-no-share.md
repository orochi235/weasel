---
'@weasel-js/editing': major
---

`useImageTool` no longer accepts `share`, which it ignored: the image tool has no options for a share to lay over.

Code passing it stops compiling; drop the option, since it never did anything.

```ts
// before
useImageTool({ src, share: { fill: null } });
// after
useImageTool({ src });
```

<!-- entry: rank=-5 breaking fix -->
