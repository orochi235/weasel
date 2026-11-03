---
'@weasel-js/core': patch
'@weasel-js/kernel3d': patch
---

Add `@weasel-js/core/engine`, the half of core a host of any dimension uses: the scene, selection, snapping, aim,
the dep contract, and the actions and tools such a host binds (`moveAction`, `insertAction`, `areaSelectAction`,
`useSelectToolWith`, `useActionSet`, `useStandardDeps`, and the rest). It loads none of the 2D stack (renderer,
text, font, stroke, text-dom, svg). kernel3d now imports from it, and from `@weasel-js/routing`.

New in core's main entry too:

- `useSelectToolWith`, the select tool over a `pickEvery` the host supplies. `useSelectTool` is unchanged and
  supplies the kit's adapter walk as before.
- `useActionSet` and `useStandardDeps`, the two halves of `useStandardActions`, for a host that names its own
  actions and should not load the kit's standard list.
- The `drawnBoxes` dep: how move, resize, rotate, flip, align, and distribute measure the box a node is shown with.
  `<SceneCanvas>` sources the stroke-inclusive measure it always used (`inkBoxes`). **A host that builds its deps
  by hand now gets each node's pose box unless it sources `drawnBoxes` itself.**
- `InsertExtras` no longer lists a typed `sticky` variant; sticky extras still match its open `{ kind: string }` case.
