---
'@weasel-js/routing': major
'@weasel-js/core': major
'@weasel-js/path-tools': major
---

Bindings, `trigger`, `begin`, `preview` and `useOngoingAction` check params against the id's `ActionParamSchema` entry, as tunings do.

This is breaking. An id the schema names takes its whole entry, required keys included, as a record or a thunk; passing no params at all is still allowed, as a palette runs an action. An id the schema does not name takes no params, so a binding or a trigger that hands params to one either adds a schema entry for it or passes the id as `dynamicActionId(id)`, the deliberate path for an id held only at runtime. A plain `string` id is one of those.

```ts
declare module '@weasel-js/core' {
  interface ActionParamSchema { 'review.stamp': { size: number } }
}

registry.trigger('review.stamp', { size: 2 });          // checked
registry.trigger('review.stamp', { size: 'wrong' });    // now an error
registry.trigger(dynamicActionId(item.action.id), item.params); // an id read at runtime
```

Augment `'@weasel-js/core'`, not `'@weasel-js/routing'`, from a package outside the kit; `@weasel-js/path-tools` now does. The kit's own actions that read params have entries: `insert`, `place`, `move`, `rotate`, `viewport.dragPan`, `lassoSelect`, `slice`, `measure`, `ingest`, `setFill`, `setStroke`, `setStrokeWidth`, `setVertexColor`, `simplifyPath`, `offsetPath`, `present.step`, `present.go`, `spiro.finish`, `girth.drag` and others. `AlignParams`, `FlipParams` and `SetFilletsParams` make each field optional, since each action defaults it. `holdPreviewId` returns a `DynamicActionId`, and the `actionParams` dep is typed as `ActionsRegistry['paramsOf']`.

<!-- entry: rank=10 breaking api -->
