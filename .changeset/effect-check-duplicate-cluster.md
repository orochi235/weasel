---
'@weasel-js/diagram': major
---

`checkPipeline` reports a repeated cluster id as `duplicate-cluster`, and names the cluster a problem is about in `cluster`.

They were `duplicate-group` and `group`. The messages are unchanged.

```ts
// before
problems.filter((p) => p.kind === 'duplicate-group').map((p) => p.group);
// after
problems.filter((p) => p.kind === 'duplicate-cluster').map((p) => p.cluster);
```

<!-- entry: breaking api -->
