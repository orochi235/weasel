---
'@weasel-js/ui': major
'@weasel-js/labkit': major
---

`Density` is now `ControlSizeScope`, so the `sm`/`md` control size no longer shares a word with the theme's `compact`/`comfortable`/`roomy` density.

The rest of the family is renamed with it: `useDensity` is `useControlSize`, `withDensity` is `withControlSize`, `DensityProps` is `ControlSizeProps`, `DensityScopeProps` is `ControlSizeScopeProps`, and the subpath `@weasel-js/ui/components/Density` is `@weasel-js/ui/components/ControlSize`. `useControlSizeScope()` is new: the nearest scope's size, or `undefined` outside every scope. labkit re-exports the new names. The theme's density is unchanged.

```tsx
// before
import { Density, useDensity } from '@weasel-js/ui/components/Density';
<Density size="sm">{toolbar}</Density>
// after
import { ControlSizeScope, useControlSize } from '@weasel-js/ui/components/ControlSize';
<ControlSizeScope size="sm">{toolbar}</ControlSizeScope>
```

<!-- entry: rank=10 breaking api -->
