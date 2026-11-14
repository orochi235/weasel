---
'@weasel-js/ui': major
---

`ActionLeaf` and `ActionsLeaf` draw an `action` or `actions` leaf in any form, replacing `BarAction`, `PrefActionButton`, and their plurals.

Both come from `@weasel-js/ui/components/Prefs`, in place of `BarAction`, `BarActions`, `PrefActionButton`, and `PrefActionRows`. They take the leaf as `leaf` and draw in the nearest `FormScope`'s form, or the `form` they are given.

```tsx
// before
<PrefActionButton pref={leaf} path="file.save" />
// after
<ActionLeaf leaf={leaf} path="file.save" form="row" />
```

<!-- entry: breaking api -->
