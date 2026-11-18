---
'@weasel-js/diagram': major
---

`grid`'s `groupColumns` option is `clusterColumns`.

```ts
// before
grid({ columns: 3, groupColumns: { services: 2 } });
// after
grid({ columns: 3, clusterColumns: { services: 2 } });
```

A Diagram JSON file written with `groupColumns` in a page's layout still loads: `@weasel-js/diagram-formats` reads it as `clusterColumns`.

<!-- entry: breaking api data -->
