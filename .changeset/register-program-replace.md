---
'@weasel-js/renderer': major
'@weasel-js/core': major
---

`registerProgram` throws on a different source under a taken id, in development as in production, unless passed `{ replace: true }`.

This is a breaking change. The same source again is no change. A module re-registering its program on hot reload passes `replace: true`, where development used to replace without it. `registerEffect` takes the same options, and `programSourceRegistry.register` returns a release for a program that should not last the page's lifetime.

```ts
// before
registerProgram('stripes', { glsl: { frag: STRIPES } });
// after, in a module that hot reload runs again with new source
registerProgram('stripes', { glsl: { frag: STRIPES } }, { replace: true });
```

<!-- entry: breaking api behavior -->
