---
'@weasel-js/routing': minor
'@weasel-js/core': minor
---

`defineAction` and `useCommand` type an action's invoker, gates and variants by its id's `ActionParamSchema` entry, with no cast.

```ts
const stamp = defineAction({
  id: 'review.stamp',
  label: 'Stamp',
  invoker: { timing: 'immediate', run: (deps, params) => stampAt(deps, params?.size ?? 1) },
});
```

Each param may be absent where the action reads it, since a palette passes none and a tuning lays only some. `ImmediateInvoker`, `OngoingInvoker`, `OngoingHandle`, `InvocationCtx`, `BindingOptions` and `UiOngoingControl` take the params type as a parameter, defaulting to an open record. `bindAction(spec, id, opts)` builds a checked binding for an id a literal cannot name alone, such as `` `${kind}.drag` ``, and `bindingOptionsOf(binding)` reads any binding's options as an open record.

<!-- entry: rank=5 new api -->
