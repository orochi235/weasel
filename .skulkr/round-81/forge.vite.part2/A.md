## Story files are keyed by platform paths but looked up by vite's posix ids, so on Windows story updates, prop controls and through-reindexing never match
- where: packages/forge/src/vite/storyIndex.ts:56 (createStoryIndex glob), with the lookups at packages/forge/src/vite/plugin.ts:105 (storiesReaching), packages/forge/src/vite/propControls.ts:108 (transform), packages/forge/src/vite/storyIndex.ts:118 (update `through`)
- scenario: on Windows, `resolve(root(), f)` makes the `files()` keys `C:\proj\src\a.stories.tsx`, while vite's `mod.file`, transform `id` and resolved import ids (which fill `reads`) are `C:/proj/src/a.stories.tsx`. So `current.has(mod.file)` never holds and no `forge:story` event is sent on an edit; `stories().includes(id)` never holds, so no story gets prop controls or an API table; and `reads.has(file)` never holds, so editing a project helper that a story's meta resolves through never re-decides that story. Keys should be normalized one way (posix, as `posixPath.ts` exists for) at the point they are made.
- evidence: read
- severity: medium

## A type imported under another name gets its definition filed under the original name
- where: packages/forge/src/vite/typeDefs.ts:47 (addTypeDefs) and :53 (addTypeDef)
- scenario: a component file has `import type { Props as ButtonProps } from './button'` and a prop typed `ButtonProps`. `addTypeDefs` finds the scope symbol by the local name `ButtonProps`, resolves the alias to the target symbol, and `addTypeDef` files it under `symbol.getName()`, which is `Props`. The reader sees `ButtonProps` with no definition, and if the file also declares its own `Props`, the two declarations collide under `Props`, which then gets set to null and loses its definition too. The definition should be keyed by the name as the text writes it.
- evidence: read
- severity: low

## A conditional type nested in a conditional's check or extends position prints without parentheses
- where: packages/forge/src/vite/typedoc/print.ts:37 (typeText, `conditional`)
- scenario: TypeDoc JSON for `(A extends B ? C : D) extends E ? F : G` or `A extends (B extends C ? D : E) ? F : G` prints as `A extends B ? C : D extends E ? F : G` or `A extends B extends C ? D : E ? F : G`. These reparse as different types, so the signature or member shown in the API panel is wrong. `checkType` and `extendsType` should go through `grouped(…, ['conditional', 'function'])` the way union and intersection members already do.
- evidence: read
- severity: low

## Files read
packages/forge/src/vite/issues/endpoint.ts
packages/forge/src/vite/moduleInfo.ts
packages/forge/src/vite/nativeExports.ts
packages/forge/src/vite/ownEntries.ts
packages/forge/src/vite/ownKeys.ts
packages/forge/src/vite/plugin.ts
packages/forge/src/vite/posixPath.ts
packages/forge/src/vite/propControls.ts
packages/forge/src/vite/propTypes.ts
packages/forge/src/vite/servePages.ts
packages/forge/src/vite/shellTitle.ts
packages/forge/src/vite/storyGlob.ts
packages/forge/src/vite/storyIndex.ts
packages/forge/src/vite/storybookShims.ts
packages/forge/src/vite/titleReport.ts
packages/forge/src/vite/trace.ts
packages/forge/src/vite/typeDefs.ts
packages/forge/src/vite/typedoc/index.ts
packages/forge/src/vite/typedoc/json.ts
packages/forge/src/vite/typedoc/print.ts
packages/forge/src/vite/virtualModules.ts
packages/forge/src/vite/warnOnce.ts
packages/forge/src/vite/watchProbe.ts
packages/forge/src/vite/watchRecovery.ts
packages/forge/src/vite/watchSettle.ts
packages/forge/src/vite/wrappers.ts

<!-- done: 3 findings, files read: 26 -->
