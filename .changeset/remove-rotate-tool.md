---
"@weasel-js/core": patch
---

Remove `useRotateTool` and the `'rotate'` built-in tool id. **Breaking:**
`'rotate'` is no longer a `BuiltinToolId`, so `defaultTools={['rotate', …]}`
and `tools={{ rotate: true }}` no longer typecheck, and the `standard` bundle
and the default tier no longer list it.

Rotation itself is unchanged. It has run through `rotateAction`, bound by the
select tool on the rotation handle, since the affordance hit-test was
consolidated; the tool contributed no bindings and its overlay painted
nothing. Drop the id from any tool list, and delete a `useRotateTool` mount
outright. `selectTool={{ rotate: false }}` still turns rotation off.
