---
'@weasel-js/prefs': major
---

`isShown` from `@weasel-js/prefs/edit` is renamed `isTreeAsset`. It says whether the structure tree shows an asset, which every kind but the action catalog is.

```ts
// before
assets.filter(isShown);
// after
assets.filter(isTreeAsset);
```

<!-- entry: breaking api -->
