---
'@weasel-js/diagram-elk': major
---

The function that answers the ELK option strings a run starts from is `elkRootOptions`.

`rootOptions` is renamed `elkRootOptions`; its argument is unchanged.

```ts
// before
const options = rootOptions({ direction: 'right' });
// after
const options = elkRootOptions({ direction: 'right' });
```

<!-- entry: breaking api -->
