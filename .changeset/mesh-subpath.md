---
"@weasel-js/core": patch
"@weasel-js/ui": patch
"@weasel-js/svg": patch
---

**Breaking:** the mesh-gradient exports moved off `@weasel-js/core` onto a new
subpath, `@weasel-js/core/mesh`: `MESH_GRADIENT_KIND`, `MESH_BAKE_SIZE`,
`bakeMesh`, `cornerWeights`, `evalPatch`, `isMeshGradientFill`,
`isTensorPatch`, `isValidPatch`, `meshBounds`, `meshFromStops`,
`meshGradientXml`, `meshStops`, `patchBounds`, `patchCorner`, `seedMeshPatch`,
and the types `BakedMesh`, `MeshBox`, `MeshGradientFill`, `MeshPatch` and
`MeshPoint`. Change the import path; nothing else about them changed. Any
import from the subpath registers the kind, as importing them from the root
did.

With esbuild and code splitting on, importing one symbol from
`@weasel-js/core` no longer ships the mesh paint: `import { asNodeId }`
bundled to 19,814 B and now bundles to 133 B. The lazily loaded mesh kind now
ships as one self-contained file that shares no module with the root barrel,
which is what esbuild needed.

New: a `PaintKindEntry` can declare its shader programs as `programs`, keyed
by program id; registering the kind registers them, and re-registering the
same source is not a duplicate. New root type export: `ProgramSource`.
