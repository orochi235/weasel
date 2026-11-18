---
'@weasel-js/core': major
---

The Escape-mid-drag action `cancelGesture` is `dispatch.cancelAll`, exported as `cancelAllAction`.

Its binding is `dispatch.cancelAll.key`. It cancels every in-flight action handle.

```ts
// before
<SceneCanvas actions={{ cancelGesture: null }} />
// after
<SceneCanvas actions={{ 'dispatch.cancelAll': null }} />
```

<!-- entry: breaking api -->
