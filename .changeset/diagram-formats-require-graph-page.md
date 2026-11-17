---
'@weasel-js/diagram-formats': major
---

The helper that narrows a page to a graph page, and throws on any other kind, is `requireGraphPage`, so its name says it can throw.

`graphPageOf` is renamed `requireGraphPage`; its arguments are unchanged.

```ts
// before
const page = graphPageOf(written, 'DOT');
// after
const page = requireGraphPage(written, 'DOT');
```

<!-- entry: breaking api -->
