# @weasel-js/icons-plugin

`weaselIcons`, the build plugin that ships only the glyphs a build names. It runs at build time, in
Node, and installs `oxc-parser`, `unplugin` and `magic-string`; the app itself never imports it.
Icon names and the registry are in `@weasel-js/icons`.

| Export | What it is |
|---|---|
| `weaselIcons` | The plugin: `weaselIcons.vite(…)`, `.rollup(…)`, `.rolldown(…)` or `.esbuild(…)` |
| `@weasel-js/icons-plugin/virtual` | Types for `virtual:weasel-icons` and its variants |

## In an app

```sh
npm install --save-dev @weasel-js/icons-plugin
```

```ts
// vite.config.ts
import { weaselIcons } from '@weasel-js/icons-plugin';

export default defineConfig({ plugins: [weaselIcons.vite({ mode: 'app' })] });
```

```tsx
/// <reference types="@weasel-js/icons-plugin/virtual" />
import { IconRegistryProvider } from '@weasel-js/core';
import icons from 'virtual:weasel-icons';

const VARIANTS = { all: () => import('virtual:weasel-icons/all') };

<IconRegistryProvider icons={icons} variants={VARIANTS}>…</IconRegistryProvider>;
```

`virtual:weasel-icons` holds the glyphs the build names, in your code and in the weasel packages
it imports. `/all`, `/<namespace>`, and custom variants (`variants: { name: { namespaces, groups,
tags } }` in the plugin options) each load as their own chunk. A name the build cannot resolve
fails it.

App mode runs under vite, rollup or rolldown. Library mode, which only rewrites `icon()` calls,
also runs under esbuild. Any other bundler is refused with an error: when the plugin is created, or
under webpack and rspack when the compiler applies it.

To write icon names in app code, put `export const icon = scopedIcon<never>('my-app');` in a
module named `icons.gen.ts` and import `icon` from it: `icon('ui:close')`. The plugin sees only
calls to an `icon` imported from such a module.
