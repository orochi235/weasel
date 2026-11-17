---
'@weasel-js/modes': major
---

`ALL_TAGS` is `SHIPPED_TAGS` and `isCapabilityTag` is `isShippedTag`, since an app's own capability tags are valid but not in the list.

```ts
// before
if (isCapabilityTag(tag)) ALL_TAGS.indexOf(tag);
// after
if (isShippedTag(tag)) SHIPPED_TAGS.indexOf(tag);
```

<!-- entry: breaking api -->
