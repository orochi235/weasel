---
'@weasel-js/ui-input': major
---

`movedIndex` and `isNoopDrop` take the list's length, and read a gap past either end and an index outside the list as `moveItems` does.

Both throw a `RangeError` for a length that is not a whole number, 0 or more.

```ts
// before
movedIndex([from], target);
isNoopDrop(at, target);
// after
movedIndex([from], target, items.length);
isNoopDrop(at, target, items.length);
```

<!-- entry: breaking api fix -->
