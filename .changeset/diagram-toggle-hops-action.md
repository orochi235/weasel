---
'@weasel-js/diagram': major
---

The line jumps command is `createToggleHopsAction`, with the id `diagram.toggleHops`, since it turns jumps on or off.

`createSetHopsAction`, `SET_HOPS_ACTION_ID` (`'diagram.hops'`) and `SetHopsOptions` are renamed `createToggleHopsAction`, `TOGGLE_HOPS_ACTION_ID` (`'diagram.toggleHops'`) and `ToggleHopsOptions`.

```ts
// before
menuRun({ hops: SET_HOPS_ACTION_ID }); // 'diagram.hops'
// after
menuRun({ hops: TOGGLE_HOPS_ACTION_ID }); // 'diagram.toggleHops'
```

<!-- entry: breaking api -->
