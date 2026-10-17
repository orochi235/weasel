# @weasel-js/icons

Namespaced icon names (`namespace:name`), the icon registry, and the build plugin that ships only
the glyphs a build names. No React, no DOM, no glyphs of its own: each weasel package that draws glyphs
publishes its own table, at `@weasel-js/<package>/icons`.

| Export | What it is |
|---|---|
| `IconRef` | A qualified name, branded. Each package's generated `icon()` makes one; `toIconRef(value)` reads one from data |
| `IconName` | Interface whose keys are every qualified name; packages extend it by declaration merging |
| `scopedIcon(namespace)` | Builds a package's `icon()`, which qualifies a bare name with that namespace |
| `IconTable` | `{ namespace, owner, icons }`: every glyph one publisher ships under one namespace |
| `createIconRegistry()` | Holds tables and overrides; refuses a namespace another owner holds |
| `@weasel-js/icons/plugin` | `weaselIcons`, the build plugin |
| `@weasel-js/icons/virtual` | Types for `virtual:weasel-icons` and its variants |

## In an app

```ts
// vite.config.ts
import { weaselIcons } from '@weasel-js/icons/plugin';

export default defineConfig({ plugins: [weaselIcons.vite({ mode: 'app' })] });
```

```tsx
/// <reference types="@weasel-js/icons/virtual" />
import { IconRegistryProvider } from '@weasel-js/core';
import icons from 'virtual:weasel-icons';

const variants = { all: () => import('virtual:weasel-icons/all') };

<IconRegistryProvider icons={icons} variants={variants}>…</IconRegistryProvider>;
```

`virtual:weasel-icons` holds the glyphs the build names, in your code and in the weasel packages
it imports. `/all`, `/<namespace>`, and custom variants (`variants: { name: { namespaces, groups,
tags } }` in the plugin options) each load as their own chunk. A name the build cannot resolve
fails it. App mode runs under vite, rollup or rolldown, not esbuild.

To write icon names in app code, put `export const icon = scopedIcon<never>('my-app');` in a
module named `icons.gen.ts` and import `icon` from it: `icon('ui:close')`. The plugin sees only
calls to an `icon` imported from such a module.

Without the plugin, pass tables by hand:
`<IconRegistryProvider icons={[coreIcons, uiIcons]}>`, each imported as `icons` from
`@weasel-js/core/icons` and `@weasel-js/ui/icons`.
