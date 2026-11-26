---
'@weasel-js/svg': minor
---

`serializeSvg` takes `decorate`, which adds a `<style>` to the document and, per node id, attributes and children to that node's element.

```ts
serializeSvg(nodes, {
  decorate: {
    style: '#a { opacity: 0.5 }',
    attrsOf: (id) => (id === 'a' ? { pathLength: '1' } : undefined),
    childrenOf: (id) => (id === 'a' ? '<animate attributeName="opacity" values="0;1" dur="1s"/>' : undefined),
  },
});
```

`style` and `childrenOf` are written as given; attribute values are escaped, and replace an attribute of the same name the element already has.

<!-- entry: api -->
