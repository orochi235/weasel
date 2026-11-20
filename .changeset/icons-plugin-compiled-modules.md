---
'@weasel-js/icons-plugin': major
---

The icon plugin reads `icon()` calls in modules another plugin compiles to JS, such as a Vue or Svelte component's script.

`weaselIcons.vite()`, `.rollup()` and `.rolldown()` now return an array of two plugins. A `plugins` list takes it as it is; code that read the result as one plugin reads its first entry:

```ts
const [icons] = weaselIcons.vite({ mode: 'app' });
```

<!-- entry: fix breaking -->
