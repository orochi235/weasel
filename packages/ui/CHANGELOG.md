# @weasel-js/ui

## 0.6.0

### Minor Changes

- Add `./components/*` subpath exports, so a consumer can import one component
  instead of the whole barrel:

  ```ts
  import { ToolPalette } from "@weasel-js/ui/components/ToolPalette";
  import { ToastRegion, toast } from "@weasel-js/ui/components/Toast";
  ```

  This needed a build change, not just an `exports` entry: the package built as a
  single `dist/index.js`, so there was nothing for a subpath to point at. The Vite
  build now emits one entry per component directory, keyed to mirror the source
  tree — which is also where `tsc --emitDeclarationOnly` already put the matching
  `index.d.ts`, so a single `*` wildcard lines up the JS and the types, and a
  component added later is reachable with no further change.

  Code shared between entries is hoisted into `dist/chunks/` rather than copied
  into each, so module-level state stays single: importing the barrel and a
  subpath in the same app yields one `defaultToastQueue`, not two.

### Patch Changes

- @weasel-js/modes@0.6.0

## 0.5.1

### Patch Changes

- 5a741be: Ship the TypeScript declarations that `ui` and `hud` already advertised.

  `@weasel-js/ui@0.5.0` and `@weasel-js/hud@0.5.0` were published with no `.d.ts`
  files at all, while their `exports` maps pointed `types` at `./dist/index.d.ts`.
  Consumers got an implicitly-`any` module.

  Both packages build as `vite build && tsc -p tsconfig.build.json`. Vite's
  `emptyOutDir` deletes the declarations the previous run emitted, but tsc's
  `--incremental` state (inherited from the repo root) still recorded them as
  emitted, and plain `--incremental` compares input signatures without checking
  whether the outputs are still on disk. So every build after the first emitted
  nothing and exited 0. A cold CI checkout only ever builds once, which is why
  this never went red. Their declaration builds are no longer incremental.

  Two gates now cover the class rather than the instance: `npm run check:manifests`
  refuses to publish a package whose `exports`/`types` map names a file that
  `npm pack` would not include, and the consumer smoke test type-imports both
  packages so a missing declaration surfaces as TS7016.

  - @weasel-js/modes@0.5.1

## 0.5.0

### Patch Changes

- @weasel-js/modes@0.5.0
