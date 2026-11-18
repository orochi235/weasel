---
'@weasel-js/text-tools': major
---

`WHITEBOARD_TOOLS` is gone; it held exactly `TEXT_TOOLS`' tools, so pass `TEXT_TOOLS`.

```tsx
// before
<SceneCanvas defaultTools={[WHITEBOARD_TOOLS]} … />
// after
<SceneCanvas defaultTools={[TEXT_TOOLS]} … />
```

<!-- entry: breaking api -->
