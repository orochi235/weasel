---
'@weasel-js/routing': major
'@weasel-js/core': major
'@weasel-js/ui': major
'@weasel-js/labkit': major
'@weasel-js/rig': major
'@weasel-js/path-tools': major
'@weasel-js/kernel3d': major
---

The kit settings area types are read from their packages' schemas, so they are type aliases and can no longer be augmented.

That covers `GestureKitSettings`, `CoreKitTargetSettings`, `ViewKitSettings`, `LoupeKitSettings`, `Orbit3dKitSettings`,
`RigKitTargetSettings` and `PathToolsKitTargetSettings`. Add a setting by augmenting `@weasel-js/react`'s `KitSettings` or `KitTargetSettings`, as before:

```ts
declare module '@weasel-js/react' {
  interface KitTargetSettings { myHandlePx: number }
}
```

<!-- entry: breaking -->
