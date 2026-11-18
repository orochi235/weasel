---
'@weasel-js/labkit': major
---

labkit's config `GroupNode` class is `ConfigGroup`, so it no longer shares its name with core's scene `GroupNode`.

```ts
// before
if (node instanceof GroupNode) …
// after
if (node instanceof ConfigGroup) …
```

<!-- entry: breaking api -->
