---
'@weasel-js/paint': major
---

Resolving a color against a palette with two entries of the same name throws, naming the name.

A palette like this used to resolve `red` to its first entry; now `resolvePaletteColor` and `resolvePaletteColors` throw:

```ts
const palette = { entries: [{ name: 'red', color: red }, { name: 'red', color: crimson }] };
resolvePaletteColor(palette, { ref: 'red' }); // throws: two entries are named "red"
```

Give each entry its own name.

<!-- entry: breaking fix -->
