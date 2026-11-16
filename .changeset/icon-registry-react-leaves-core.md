---
'@weasel-js/core': major
'@weasel-js/icons': minor
---

`IconRegistryProvider`, `useIconGlyph` and the rest of the icon registry's React side move from `@weasel-js/core` to `@weasel-js/icons/react`.

This is breaking: import `IconRegistryProvider`, `IconRegistryProviderIfRoot`, `IconRegistryScope`, `useIconRegistry`, `useIconGlyph`, `useIconVariant` and `IconRegistryProviderProps` from `@weasel-js/icons/react`. `@weasel-js/core/engine` no longer carries `IconRegistryProvider`. React is an optional peer of `@weasel-js/icons`; its main entry still loads none.

```tsx
import { IconRegistryProvider } from '@weasel-js/icons/react';
```

<!-- entry: rank=10 breaking api -->
