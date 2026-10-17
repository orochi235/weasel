# @weasel-js/icons

Namespaced icon names (`namespace:name`) and the icon registry. No React, no DOM, no glyphs of its
own: each weasel package that draws glyphs publishes its own table, at `@weasel-js/<package>/icons`.
The build plugin that ships only the glyphs a build names is `@weasel-js/icons-plugin`.

| Export | What it is |
|---|---|
| `IconRef` | A qualified name, branded. Each package's generated `icon()` makes one; `toIconRef(value)` reads one from data |
| `IconName` | Interface whose keys are every qualified name; packages extend it by declaration merging |
| `scopedIcon(namespace)` | Builds a package's `icon()`, which qualifies a bare name with that namespace |
| `IconTable` | `{ namespace, owner, icons }`: every glyph one publisher ships under one namespace |
| `createIconRegistry()` | Holds tables and overrides; refuses a namespace another owner holds |

## In an app

```tsx
import { IconRegistryProvider } from '@weasel-js/core';
import { icons as coreIcons } from '@weasel-js/core/icons';
import { icons as uiIcons } from '@weasel-js/ui/icons';

const ICONS = [coreIcons, uiIcons];

<IconRegistryProvider icons={ICONS}>…</IconRegistryProvider>;
```

That registers every glyph core and ui draw. To ship only the glyphs the app names, use
`@weasel-js/icons-plugin`.
