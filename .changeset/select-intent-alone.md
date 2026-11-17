---
'@weasel-js/select': major
---

The `SelectIntent` that selects the pressed id by itself is `'alone'`, where it was `'single'`.

It no longer shares a value with `SelectionMode`'s `'single'`.

```ts
// before
select(state, id, 'single');
// after
select(state, id, 'alone');
```

<!-- entry: breaking api -->
